# ⏰ Use Couchbase with a Recurring Timer for Auto Aggregation ⏰

<br><br>

It's common to see high volume data ingestion while needing to have a mechanism to automatically aggregate every minute / hour, or any other defined time span, for real time insights. The conventional thinking is to use Kafka to stream data for a raw transaction table/collection, and additionally set up another client with a cron job to slicing the data, do aggregation, and write back to another table. Something like below:

![image](https://github.com/user-attachments/assets/2a6a9f1f-c818-4ca2-85fc-249f96b8af67)


<br><br>

Another thinking: why don't we leverage Couchbase for this? 


![image](https://github.com/user-attachments/assets/62869be5-bb77-4f44-a66b-54d989b070ce)



<br><br>


## What Are the Options

<br>
There's really more than 1 ways of achieving this with Couchbase. And you'll have to figure out a good mix and balance of dev simplify, service level, and scalability. Overall we'll be looking at options below, what i call the **convenient**, the **quick**, and the **quickest** methods. 



# Setup

<br>


Set up a single-node Couchbase cluster with **Data, Index, Query, Eventing** service deployed. If you are not familiar with Couchbase cluster setup, follow [this](https://docs.couchbase.com/server/current/manage/manage-nodes/create-cluster.html) documentation. I'm using **t2.2xlarge** with **8 vCPU** and **32GiB** of Memory. 

>🙌🏻 This single-node deployment is really just for testing purposes. For any production workload you'd want at least 3 nodes (for Data service) or 2 nodes (for other Couchbase services) for High Availability services. It's also a good idea to leverage Couchbase's [multi-dimensional scaling](https://docs.couchbase.com/operator/current/concept-mds.html) for isolcated workloads deployment when necessary.


<br><br>


## Clone Project and Run Scripts for Setup


<br>


Clone this repo 
```
git clone https://github.com/sillyjason/auto_data_aggregation
```

<br>

At the project root directory, create a .env file with the following env variables
```
# EE Environment Variables 
EE_HOSTNAME= // hostname of any Couchbase node with Data service deployed
EVENTING_HOSTNAME= // hostname of your Couchbase node with Eventing service deployed

#CB User Credential
CB_USERNAME= // username for admin credentials to Couchbase cluster
CB_PASSWORD= // password for admin credentials to Couchbase cluster
```

<br>

Install Python dependencies
```
pip install -r requirements.txt
```

<br>

Run the script for setting up buckets, scopes and collections 
```
python3 setupcollections.py 
```

<br>


Run the script for setting up Eventing functions 
```
python3 setupeventing.py 
```

<br>

>🙌🏻 We'll call the Couchbase Rest API endpoints to set up 3 Eventing functions. **on_data_input**, together with **on_data_input_junior** is Couchbase's answer to real-time data processing at speed and scale.
>
> **recur_aggregation_trigger** is for creating the recurring job for aggregation every minute. 

<br>


Run the script for setting up GSI (global secondary index) and the initial documents needed as document triggers 
```
python3 setupdata.py 
```

<br><br>

Right now we have almost everything we need to get the engine running. Log in Couchbase cluter, go to **Eventing** tab, and Deploy all 3 functions. 


![image](https://github.com/user-attachments/assets/34ca0f45-d863-4b24-be52-41cbd10cbefa)


<br>

# Let's Begin with the Convenient Approach

<br>

Back to the python app. Run the dataingest script
```
python3 dataingest.py
```

<br>



<br>


🎊 Voilà! With Couchbase Eventing, we don't even need an external server for scheduling aggregation tasks every defined period. Couchbase serves as a reliable and scaling platform for data operations. 

BUT - there's one catch. If you require the timers to be fired with "wall-clock" accuracy, read on.


<br><br>


# Being Wall-clock Accurate 

<br>

Let's run some queries to see when exactly are our Eventing timers fired. 

<br>

Go to **Query** tab, and let's fire the following. Yes, Couchbase is a NoSQL database that supports SQL.
```
select start_time_fmt, trigger_time_fmt 
from `main`.`aggregation`.`minute`
order by trigger_time
```

<br>

From the result page, select **Table** tab to make it less painful to see the timings. **trigger_time_fmt** records when the eventing is fired and obviously, despite being intentionally scheduled at the beginning of every minute, there is 3-7 seconds' delay.

![image](https://github.com/user-attachments/assets/0283e443-87c8-49cc-9d16-0286f162c7c6)

<br>

>🙌🏻 To understand how the timers are scheduled, the logics are contained within the Javascript codes of the respective function under **Eventing** tab. 

<br>

Couchbase recurring timer, despite being convenient to set up and manage, does not guarantee [wall-clock accuracy](https://docs.couchbase.com/server/current/eventing/eventing-timers.html#sharding-of-timers). That is to say, if the requirement is the aggregation function be fired at exactly the beginning nanoseond of the minute, Couchbase Eventing might not be the best option. 

In this case, you can just create a light weight app that schedules the job more punctually to send queries to Couchbase, who processes it lightening fast. An example is set up in **app.py**. 

<br>

The function in the example fires the following query to Couchbase, which performs the aggregation, and directly insert output into a collection. 

```
INSERT INTO `main`.`aggregation`.`minute_api` (KEY k, VALUE v)
    SELECT v.start_time k, v
    FROM
    (
        WITH n AS (TRUNC(NOW_MILLIS()/1000))
            ,o AS (n%60)
            ,e AS (n-o)
            ,s AS (e-60)
        SELECT
            DATE_TRUNC_STR(DATE_ADD_STR(NOW_STR(),-1,"minute"),"minute") AS start_time,
            DATE_TRUNC_STR(NOW_STR(),"second") AS trigger_time,
            COUNT(1) AS count,
            AVG(`amount`) AS average_amt,
            SUM(`amount`) AS total_amt,
            {"silver": SUM(CASE WHEN cust_type = "silver" THEN 1 ELSE 0 END),
            "gold": SUM(CASE WHEN cust_type = "gold" THEN 1 ELSE 0 END),
            "platinum": SUM(CASE WHEN cust_type = "platinum" THEN 1 ELSE 0 END)
            } AS category
        FROM `main`.`data`.`data`
        WHERE `time_unix` BETWEEN s AND e
    ) v
    RETURNING DATE_TRUNC_STR(DATE_ADD_STR(NOW_STR(),-1,"minute"),"minute") AS start_time
```

<br>

With **RETURNING DATE_TRUNC_STR(DATE_ADD_STR(NOW_STR(),-1,"minute"),"minute")** AS start_time, we're capturing the document key, with which we can insert the time of this task's initiation time into the same document with Couchbase's [sub-document insert](https://docs.couchbase.com/python-sdk/current/howtos/subdocument-operations.html).

<br>

Go to Couchbase console, under **Documents** tab, switch to **`main`.`aggregation`.`minute_api`**, and see the results being written.

<br>

![image](https://github.com/user-attachments/assets/23b66a3e-b403-4f31-b440-191914065db7)

<br><br>


## Let's Do Some Digging

<br>

Go to **Query** tab, and run the following:
```
select meta().id, 
sender_task_start_time, 
TRUNC(META().cas/1000000) - sender_task_start_time as sdk_cycle_time, 
MILLIS_TO_UTC(META().cas/1000000) as doc_available_time_fmt,
TRUNC(META().cas/1000000) as doc_available_time
from minute_api
order by start_time desc
```

<br>

>🙌🏻 **META().cas** is the server timestamp of last update in nanosecond; derived from META().cas, doc_available_time_fmt is the time of doc being available at precision of milliseconds – indicating how many ms elapsed since the beginning of the minute.
>
> **sender_task_start_time** is when the external timer started the task
>
> **sdk_cycle_time** is the time it takes Couchbase to process and query and make ready the output document (including the time it takes for CB server to receive the request). So obviously it's taking Couchbase less than 400ms to run a query that aggregates 90,000+ documents and persist output with just 1 node of minimum resources.


<br>


![image](https://github.com/user-attachments/assets/8b2f777a-1513-4137-a16d-4c7a4fb374ef)






