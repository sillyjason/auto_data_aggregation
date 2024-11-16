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


<br><br>

# Setup

<br>


Set up a Couchbase cluster with **Data, Index, Query, Eventing** service deployed. If you are not familiar with Couchbase cluster setup, follow [this](https://docs.couchbase.com/server/current/manage/manage-nodes/create-cluster.html) documentation. I'm using 2 machines of **t2.2xlarge** with **16 vCPU** and **32GiB** of Memory. 

>🙌🏻 This 2-node deployment is really just for testing purposes. For any production workload you'd want at least 3 nodes (for Data service) or 2 nodes (for other Couchbase services) for High Availability services. It's also a good idea to leverage Couchbase's [multi-dimensional scaling](https://docs.couchbase.com/operator/current/concept-mds.html) for isolcated workloads deployment when necessary.


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
>
> If you're interested in understanding Couchbase Eventing in further depth, [this](https://docs.couchbase.com/server/current/eventing/eventing-examples.html) page has a few short examples.


<br>


Run the script for setting up GSI (global secondary index) and the initial documents needed as document triggers 
```
python3 setupdata.py 
```

<br><br>

Right now we have almost everything we need to get the engine running. 


<br>

# Let's Begin with the Convenient Approach

<br>

Back to the python app. Run the dataingest script
```
python3 dataingest.py
```

<br>

We've set up a continuous 1000 write-per-second stream for data ingestion. 

![image](https://github.com/user-attachments/assets/4872ac43-72c5-4dff-b970-5989e9fd8639)

<br>

Go to Couchbase and verify this qps. The **ops/sec** metric should reflect this number, give or take. "Give" as in additional writes from the Eventing functions, "take" as in my when the machine (such as my laptop) running the data ingestion sometimes is limited by its own available resources and hence running short of achieving the 1000/sec.

![image](https://github.com/user-attachments/assets/d9379c3c-0691-4c51-b904-82ad9a939f8d)


<br>

Go to **Eventing** tab, and let's deploy the function **recur_aggregation_trigger**. 

>🙌🏻 Leave the other 2 functions alone at the moment. They'll serve their purpose later. 

<br>

![Screenshot 2024-11-16 at 9 03 31 PM](https://github.com/user-attachments/assets/4a7f3b72-d0a8-4b67-b63a-baca07b1fb27)


Now when we go to **Documents** tab, select **data.aggregation.m_rt_all** namespace, the minutely aggregation result show already be there.  

![Screenshot 2024-11-16 at 9 04 07 PM](https://github.com/user-attachments/assets/6719fa79-0dd6-4efa-b147-d1e86ad094f7)


<br>

🎊 Voilà! Now we see Couchbase being more than a mere NoSQL JSON store. If you're wondering how the minutely aggregation is done, the secret sause is a mix of the following: 
- Couchbase **Eventing** which is an in-memory pub-sub implementation of db-level event-driven architecting,
- Ability to embed **SQL** queries into the script of the Eventing function  
- Create **timers** directly with Couchbase Eventing to automate the job

Quite convenient eh? But let's do some checking and evaluation.

<br><br>


## Data Integrity Check 

<br>

How do we make sure the query is not missing out on any transactions? Easy. Couchbase let's you query the data with SQL. 

Say, for this minute **10:48**. The query says there are 5600 transactions for this minute (the gap of 400 from 6000) is as mentioned above, my hardware resource is limited. 

![Screenshot 2024-11-16 at 9 05 01 PM](https://github.com/user-attachments/assets/2e0f24f1-fa0e-45fd-aa8a-757582755065)
)

<br>

To verify, simply to go Query tab, and let's run the following: 
```
SELECT SUM(1) AS total_transactions
FROM `main`.`data`.`data`
WHERE time_str LIKE "2024-11-16 10:48%"
```

<br>

Bingo.

![Screenshot 2024-11-16 at 9 05 37 PM](https://github.com/user-attachments/assets/8eee25bc-2c57-4d76-b7f1-8eeac83399b5)


<br><br>

## Service Level Check 

<br>

Let's run some queries to see when exactly are our Eventing timers fired. 

<br>

Stay on **Query** tab, and let's fire the following. Yes, Couchbase is a NoSQL database that supports SQL.
```
select start_time_fmt, trigger_time_fmt 
from `main`.`aggregation`.`m_rt_all`
order by trigger_time
```

<br>

Switch to **Table** view. Notice anything? The **trigger_time_fmt** indicates when this function is triggered. And we can see for every minute (10:35, for example), the aggregation needs to wait ~5 seconds past the next minute to trigger (10:36:06, in the same example). Of course it's safe to assume the process of query and subsequent insertion of the output will happen even later. 

![Screenshot 2024-11-16 at 9 07 25 PM](https://github.com/user-attachments/assets/196b0737-7402-4b15-8290-68cfd6b6f4b7)


<br>

For some industries (such as F&B or retail), this seconds delay shouldn't be a big deal. For others (such as financial services), this delay is unacceptable. So, how can we make it faster?

<br>

## Being Wall-clock Accurate

Couchbase recurring timer, despite being convenient to set up and manage, does not guarantee [wall-clock accuracy](https://docs.couchbase.com/server/current/eventing/eventing-timers.html#sharding-of-timers). That is to say, if the requirement is the aggregation function be fired at exactly the beginning nanoseond of the minute, Couchbase Eventing might not be the best option. Let's look at option2.


<br><br>


# The Quick Approach

<br>

Before we start talking about option 2, one important question to ask is, which field should we look at: the timestamp on client, or the timestamp at server? In the approach above the client side timestamp was used. Now let's look at the server-side timestamp implementation. With Couchbase, it's done with Eventing too.   

<br>

Let's first flush **main** bucket. 

![Screenshot 2024-11-16 at 8 57 52 PM](https://github.com/user-attachments/assets/ff2b041b-efcf-4aae-a734-2c9c7d2deb09)


<br>

And we don't need the function recur_aggregation_trigger anymore. So let's de-activate it.

![image](https://github.com/user-attachments/assets/4cf3797f-ff6c-45bb-a979-61847e5cf759)

<br>

Go back to IDE, open another Terminal window, and run the timer script which will trigger the aggregation exactly at the beginning milliseconds of the minute: 
```
python3 timer.py
```

<br>

Go grab a cub of your favourate espresso, come back and there should already be some minutely aggregations. 

![image](https://github.com/user-attachments/assets/756a8ecf-69c2-44f3-8dbe-725886b78d82)

<br>

Let's use a more convenient way to look up the data. Go to **Query** tab.

```
select meta().id, 
count,
sender_task_start_time, 
MILLIS_TO_UTC(META().cas/1000000) as doc_available_time_fmt,
trunc(META().cas/1000000 - str_to_millis(meta().id) - 60000) as readiness_time_delta
from `main`.`aggregation`.`m_api_all`
order by start_time
```

<br>

Switch to Table view so results are more readable.

![Screenshot 2024-11-16 at 9 25 59 PM](https://github.com/user-attachments/assets/36e770d9-43b9-45d7-8533-3a5ee21afa43)

<br>

Let's break it down: 
- "count": how many transactions are captured in this aggregation
- "doc_available_time_fmt": when this aggregation document became available on server. We're leveraging a metadata attribute here
- "id": on which minute was this aggregation done
- "readiness_time_delta": take the first row as an example. It was for 12:27:00, so once 12:28:00 is passed, this doc should be ready ASAP. The time delta since 12:28 is therefore calculated

<br>

So, an aggregation every minute is ready at ~500 milliseconds passed the minute. Whether this passes the service level check? Depends on your service level.

<br>

## Data Integrity Check 

<br>

Is this a perfect approach? Depends. For one, 500ms might not be a satisfactory latency in some cases. More importantly, Couchbase Query service plus Index Service is used for aggregation, and although through Couchbase Database Change Protocol, data mutations are subscribed by Indexers to update indexes in near-real-time, they adhere to a [Eventual-consistency](https://docs.couchbase.com/server/current/learn/services-and-indexes/indexes/index-lifecycle.html#index-updates) pattern. In situations where there's huge amount of data mutations and limited resources, it can take a while for update the index. While Couchbase Query provides [SCAN CONSISTENCY](https://docs.couchbase.com/server/current/n1ql/n1ql-manage/query-settings.html#scan_consistency) for queries, we don't want the index building to becomes bottlenecks when speed is paramount.

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






