# Use Couchbase with a Recurring Timer for Auto Aggregation

It's common to see high volume data ingestion while needing to have a mechanism to automatically aggregate every minute / hour, or any other defined time span, for real time insights. The conventional thinking is to use Kafka to stream data for a raw transaction table/collection, and additionally set up another client with a cron job to slicing the data, do aggregation, and write back to another table. Something like below:

![image](https://github.com/user-attachments/assets/30650f20-1057-404a-b1bd-a60e2edf261c)


<br>

Another thinking is, why don't we leverage Couchbase for this? 


![image](https://github.com/user-attachments/assets/d5941320-fc06-431a-bffb-6ff8778a4e54)


<br><br>




## Setup

<br>


Set up a Couchbase cluster with the following service groups. If you are not familiar with Couchbase cluster setup, follow [this](https://docs.couchbase.com/server/current/manage/manage-nodes/create-cluster.html). I'm using 5 virtual machines X 8vCPU & 32GB of memory, with the following Service Group configuration: 

Service Group 1: 
- Index (5GB of RAM) + Query (1GB of RAM) + Data (rest of RAM)   
- 3 nodes 

Service Group 2: 
- Eventing   
- 2 nodes 


<br><br>


## Clone Project and Run Scripts for Setup


<br>


Clone the repo 
```
git clone https://github.com/sillyjason/auto_data_aggregation
```

<br>

At the project root directory, create a .env file with the following env variables
```
# EE Environment Variables 
EE_HOSTNAME= //the hostname of any node that has Data service deployed. 
EVENTING_HOSTNAME= //the hostname of any node that has Eventing service deployed

#CB User Credential
CB_USERNAME= // username for admin credentials to Couchbase cluster 
CB_PASSWORD= // password for admin credentials to Couchbase cluster
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

>🙌🏻 **recurr_ingestion_trigger**, together with **recur_final_ingestion** is for creating the recurring timer for data ingestion job. In real time you would use a streaming tool for the job but for simplicity of our case, we'll delegate even this to Couchbase Eventing.
> **recur_aggregation_trigger** is for creating the recurring job for aggregation every minute. 

<br>


Run the script for setting up GSI (global secondary index) and the initial documents needed as document triggers 
```
python3 setupdata.py 
```

<br><br>


## Couchbase Tour

<br>

Right now we have almost everything we need to get the engine running. Log in Couchbase cluter, go to **Eventing** tab, and Deploy all 3 functions. 


![image](https://github.com/user-attachments/assets/b7e6e1df-4648-4b18-953f-e42f599b9b28)



<br>

Go to **Documents** tab, change to keyspace **eventing._default.one_off_trigger_one**, where there's already a document created previously. Here **count** determines volume of data inserted every minute by Eventing (say, a value of 300 would lead to 300 * 300 = 90,000 documents created per minute). Change to value of **active** to **true** to trigger the function for recurring timer creation. 

```
{
  "count": 300,
  "active": false
}
```

<br>


Go back to Eventing tab, click on **log** button of function "recurr_ingestion_trigger", and the logs with timer created should display on top. 

```
2024-10-31T16:28:08.078+00:00 [INFO] "From OnUpdate: create/overwrite doc.active" true "56e09222-9b39-4cfa-9d3f-df0bf721f6d6" 

2024-10-31T16:28:08.078+00:00 [INFO] "From CreateRecurringTimer: creating timer" "via_onupdate" "56e09222-9b39-4cfa-9d3f-df0bf721f6d6" 
```

<br>

Wait a minute, and you should be able to see documents pop up in **Data** tab.

![image](https://github.com/user-attachments/assets/bbb72f38-0d70-42f5-a75b-4ebdabac8902)


<br>

Now let's trigger the other timer for aggregation.  Go to **eventing._default.one_off_trigger_two**, and change the value of "active" to true.

<br>

![image](https://github.com/user-attachments/assets/724b1706-96d6-4c0a-87c0-6298761481ba)


<br>

Wait one more minute to see aggregation result every minute popping up: 

![image](https://github.com/user-attachments/assets/07e2ce1e-290d-4003-bc78-0afb51923fc6)



