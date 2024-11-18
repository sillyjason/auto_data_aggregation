<br><br>

# 🚀 Use Couchbase with a Recurring Timer for Auto Aggregation 🚀

<br>

It's common to see high volume of data ingestion plus having to run aggregate every minute or any other defined time span, for real time insights. To achieve this you probably need a database, a streaming tool, and some query tool. And even with this, most ofteh there're challenges with scalability and kv inserts, and speed of which to aggregate data since they keep coming in every second at large volume. Coupled with a high speed SLA, it becomes a headache for many an architects and DBAs. 

This demo wants to show you a Couchbase point-of-view. There are more than 1 way to do it actually, we just need a good balance of dev simplify, service level, and scalability. In this demo we'll look at 3 approaches, what i call the [CONVENIENT](https://github.com/sillyjason/auto_data_aggregation/blob/main/README.md#lets-begin-with-the-convenient-approach) the [QUICK](https://github.com/sillyjason/auto_data_aggregation/blob/main/README.md#the-quick-approach), and the [QUICKEST](https://github.com/sillyjason/auto_data_aggregation/blob/main/README.md#the-quickest-approach). 


<br><br>

# Setup

Set up a Couchbase cluster with **Data, Index, Query, Eventing** service deployed. If you are not familiar with Couchbase cluster setup, follow [this](https://docs.couchbase.com/server/current/manage/manage-nodes/create-cluster.html) documentation. I'm using 4 machines of **t2.2xlarge** with **16 vCPU** and **32GiB** of memory. 2 machines with Data, Index and Query servies deployed, and 2 other with Eventing. 

Yes. You can deploy services independently on Couchbase that's one of the benefits you get - making your infrastructure more resilient, and so sudden surge on query, for example, won't consume all computing powers and cause massive time out to your data insertions. To dig deeper, read our documents on [Multi-dimensional Scaling](https://www.couchbase.com/multi-dimensional-scalability-overview/).


<br><br>


## Clone Project and Run Scripts for Setup

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

Install Python dependencies (and create a python virtual environment if it helps)
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

>🙌🏻 Eventing is Couchbase's answer to event-driven architecture, **at scale**. Other than common implementations with oplogs, we implemented a pub/sub streaming mechanism to make sure scalability is taken care of from day 1.
>
> We'll call the Couchbase Rest API endpoints to set up 3 Eventing functions. **on_data_input**, together with **on_data_input_junior** is Couchbase's answer to real-time data processing at speed and scale.
>
> **recur_aggregation_trigger** is for creating the recurring job for aggregation every minute.
>
> If you're interested in understanding Couchbase Eventing in further depth, [this](https://docs.couchbase.com/server/current/eventing/eventing-examples.html) page has a few short examples.


<br>


Run the script to build relevant indxes and create initial documents needed as triggers. 
```
python3 setupdata.py 
```

<br>

We're ready to start ingesting data. Run the dataingest script, which will start writing into the Couchbase bucket with a speed of 1000 insert per second. 

```
python3 dataingest.py
```

<br>

![image](https://github.com/user-attachments/assets/4872ac43-72c5-4dff-b970-5989e9fd8639)

<br><br>

# Let's Begin with the Convenient Approach

![MEM1](https://github.com/user-attachments/assets/451bab91-54cd-4cd2-b086-7c20961890cb)

<br>

Go to Couchbase and verify this qps. The **ops/sec** metric should reflect this number, give or take. "Give" as in additional writes from the Eventing functions, "take" as in my when the local machine (such as my laptop) running has limited computing power.

![Screenshot 2024-11-16 at 10 22 20 PM](https://github.com/user-attachments/assets/152e6b98-d963-4168-bfb9-6786e8e003f4)

<br>

Go to **Eventing** tab, and let's deploy the function **recur_aggregation_trigger**. 

<br>

![Screenshot 2024-11-16 at 9 03 31 PM](https://github.com/user-attachments/assets/4a7f3b72-d0a8-4b67-b63a-baca07b1fb27)

<br>

>🙌🏻 Leave the other 2 functions alone at the moment. They'll serve their purpose later. 

<br>

Now when we go to **Documents** tab, select **data.aggregation.m_rt_all** namespace, the minutely aggregation result show gradually show up.  

![Screenshot 2024-11-16 at 9 04 07 PM](https://github.com/user-attachments/assets/6719fa79-0dd6-4efa-b147-d1e86ad094f7)


<br><br>

🎊 Voilà! Now we see Couchbase being more than a mere NoSQL JSON store. If you're wondering how the minutely aggregation is done, the secret sause is a mix of the following: 
- Couchbase [**Eventing**](https://docs.couchbase.com/server/current/eventing/eventing-overview.html) which is an in-memory pub-sub implementation of db-level event-driven architecting,
- Ability to embed [**SQL**](https://docs.couchbase.com/cloud/eventing/eventing-handler-basicN1qlSelectStmt.html) queries into the script of the Eventing function  
- Create [**Recurring Timers**](https://docs.couchbase.com/server/current/eventing/eventing-timers.html) directly with Couchbase Eventing to automate the job

Quite convenient eh? But let's do some checking and evaluation.

<br><br>


## Data Integrity Check 

How do we make sure the query is not missing out on any transactions? Say, for the document **2024-11-16T10:48:00Z**, which represent the minute of 10:48, the output shows a total of **56,000** documents retrieved from query. Is that the **ACTUAL** number of documents inserted into Couchbase for the past minute?

![Screenshot 2024-11-16 at 9 05 01 PM](https://github.com/user-attachments/assets/2e0f24f1-fa0e-45fd-aa8a-757582755065)

<br>

Easy. Couchbase let's you query your data with SQL syntax. Let's run the following at **Query** tab: 
```
SELECT SUM(1) AS total_transactions
FROM `main`.`data`.`data`
WHERE time_str LIKE "2024-11-16 10:48%"
```

<br>

Bingo. The deviation from **60,000** (1000 writes per second) is again, a fact that I need to upgrade my laptop.

![Screenshot 2024-11-16 at 9 05 37 PM](https://github.com/user-attachments/assets/8eee25bc-2c57-4d76-b7f1-8eeac83399b5)


<br><br>

## Service Level Check 

Let's run some queries to see when exactly are our Eventing timers fired, and hence, get some insights of when the output would be available.

<br>

Stay on **Query** tab, and let's fire the following. 
```
select start_time_fmt, trigger_time_fmt 
from `main`.`aggregation`.`m_rt_all`
order by trigger_time
```

<br>

Switch to **Table** view. Notice anything? The **trigger_time_fmt** indicates when this function is triggered. And we can see for every minute (10:35, for example), the aggregation needs to wait around **5 seconds** past the next minute to trigger (10:36:06, in the same example). Then it's safe to assume the process of query and update aggregate doc will add up the latency. 

![Screenshot 2024-11-16 at 9 07 25 PM](https://github.com/user-attachments/assets/196b0737-7402-4b15-8290-68cfd6b6f4b7)


<br>

Let's stop the ingestion script for now and think about this option. For some industries (such as F&B or retail), this seconds delay shouldn't be a big deal. For others (such as financial services), this delay is unacceptable. So, how can we make it faster?

<br><br>

## Being Wall-clock Accurate

Couchbase recurring timer, despite being convenient to set up and manage, does not guarantee [wall-clock accuracy](https://docs.couchbase.com/server/current/eventing/eventing-timers.html#sharding-of-timers). That is to say, if the requirement is the aggregation function be fired at exactly the beginning nanoseond of the minute, Couchbase Eventing might not be the best option. Let's look at option2.


<br><br>


# The Quick Approach

Let's first flush **main** bucket. 

![Screenshot 2024-11-16 at 8 57 52 PM](https://github.com/user-attachments/assets/ff2b041b-efcf-4aae-a734-2c9c7d2deb09)


<br>

And we don't need the function recur_aggregation_trigger anymore. So let's de-activate it.

![image](https://github.com/user-attachments/assets/4cf3797f-ff6c-45bb-a979-61847e5cf759)

<br>

Go back to IDE, open another Terminal window, and run the **timer** script which will trigger the aggregation exactly at the beginning milliseconds of the minute: 
```
python3 timer.py
```

<br>

Go grab a cub of your favourate espresso, come back and there should already be some minutely aggregations. 

![image](https://github.com/user-attachments/assets/756a8ecf-69c2-44f3-8dbe-725886b78d82)

<br>

After the caffeine break, let's use a more convenient way to look up the aggregate data this time. Go to **Query** tab.

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

We're now querying against the **m_api_all** collection which holds the result of queries fired through **timer.py**. Switch to Table view so results are more readable.

![Screenshot 2024-11-16 at 9 25 59 PM](https://github.com/user-attachments/assets/36e770d9-43b9-45d7-8533-3a5ee21afa43)

<br>

Let's break it down: 
- "count": how many transactions are captured in this aggregation
- "doc_available_time_fmt": when this aggregation document became available on server. We're leveraging a metadata attribute here
- "id": on which minute was this aggregation done
- "readiness_time_delta": take the first row as an example. It was for 12:27:00, so once 12:28:00 is passed, this doc should be ready ASAP. The time delta since 12:28 is therefore calculated

<br>

So, an aggregation every minute is ready at **~500 milliseconds** passed the minute. Let's stop the data ingestion script do some reflection.

<br>

Is it the perfect approach? Depends. 

For one, **500ms** might not be a satisfactory latency in some cases. 

More importantly, Couchbase Query service plus Index Service is used here for aggregation, and although through Couchbase Database Change Protocol (DCP), data mutations are subscribed by [Indexers](https://docs.couchbase.com/server/current/learn/services-and-indexes/indexes/index-lifecycle.html#index-updates) to update indexes in near-real-time, they adhere to a **eventual-consistency** pattern. So in situations where there's huge amount of data mutations and limited resources, it can take a while for update the index. 

While Couchbase Query provides [SCAN CONSISTENCY](https://docs.couchbase.com/server/current/n1ql/n1ql-manage/query-settings.html#scan_consistency) for queries, we don't want the index building to becomes bottlenecks when speed is paramount.

> 🙌🏻 There's also a key distinction between client time and server time. We're implementing based on the former but there are also scenarios where the latter makes more sense. 

<br><br>


# The Quickest Approach

Is there a way to make sure the aggregation doc is there at the exact millisecond pass the minute? 

Yes.

![image](https://github.com/user-attachments/assets/1f6bd9d9-feda-47a5-bf5e-aa94148006d7)

<br>

Couchbase is built for excellent scalability with **key-value** ops. Together with Eventing, we can capture mutations and perform aggregation logics, and concurrently update result extremely fast and reliably. 

That means we don't have the wait until the minute is passed to start working on the aggregation; rather, every new transaction is captured and aggregated instantly. Let's dig in (remember to shut down the timer.py scripts if you have not yet, since we no longer need it).

<br>

Let's flush again the bucket. Then, go to **Eventing** tab and deploy function **on_data_input_junior**. Leave **on_data_input** alone for now.

![image](https://github.com/user-attachments/assets/6347bf34-53b9-4f44-9643-bf4159cacf04)


<br>

Once deployment is done, restart the data ingestion script. Give it a couple of minutes, and let's run the query again to see how early our aggregation can be ready. 

```
select meta().id, 
count,
sender_task_start_time, 
MILLIS_TO_UTC(META().cas/1000000) as doc_available_time_fmt,
trunc(META().cas/1000000 - str_to_millis(meta().id) - 60000) as readiness_time_delta
from `main`.`aggregation`.`m_e_kv_all`
order by start_time
```

<br>

Pay attention to the **readiness_time_delta** output.

<img width="829" alt="Screenshot 2024-11-18 at 9 32 32 PM" src="https://github.com/user-attachments/assets/ee2f1ac4-d36e-4ff9-8ebb-a80b4dc47050">

<br><br>

Why are there minus time delta? Well, that means the aggregation is done right after the data mutations. 

What happening under the hood, is that the 1000 writes per second is being instantaneously passed from Couchbase Data service to Eventing service, which will write back to the same aggregation doc. This means, if your last transaction happens at the last 10 millisecond of the minute, given Couchbase 5 ms to process, the aggregation document is ready BEFORE the next minute! 

<img width="479" alt="image" src="https://github.com/user-attachments/assets/cbffe52b-c20f-4b04-8e18-68460ccd53e6">

<br><br>

# The Race Condition Problem

If you're a database guru, a big red light's probably looming over your head - race condition. After all, we are doing 1000 thousand aggregation updates per second on a single document. 

Worry not, it can be taken care of by Couchbase's [CAS mechanism](https://docs.couchbase.com/java-sdk/current/howtos/concurrent-document-mutations.html) and versatility of Javascript used by Couchbase Eventing functions. If you are interested on how exactly this is done, head over to Eventing, while we can see how a re-try mechanism is implemented to circumvent the race condition problem.

<img width="1671" alt="Screenshot 2024-11-18 at 9 42 27 PM" src="https://github.com/user-attachments/assets/65626d75-c0e9-47d7-a2be-7c759b2f9bfa">

<br>

If you'interested to dig on, there's also the other function **on_data_inpput**, which does exact the same thing as its little brother - except it aggregates at individual user level. Feel free to deploy it and see what happens to the **main.aggregation.m_e_kv_users** collection!

<br>

And in this case, since we'll be looking at multiple user aggregation documents, the way to validate that Eventing is indeed capturing all mutations, is through another quick SQL, something like below: 
```
SELECT SUM(count) AS count_sum
FROM `main`.`aggregation`.`m_e_kv_users`
WHERE META().id LIKE "2024-11-18T12:21%"
```

<br>





