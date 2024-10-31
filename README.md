# Use Couchbase with a Recurring Timer for Auto Aggregation

It's common to see high volume data ingestion while needing to have a mechanism to automatically aggregate every minute / hour, or any other defined time span, for real time insights. The conventional thinking is to use Kafka to stream data for a raw transaction table/collection, and additionally set up another client with a cron job to slicing the data, do aggregation, and write back to another table. Something like below:

![image](https://github.com/user-attachments/assets/30650f20-1057-404a-b1bd-a60e2edf261c)


<br>

Another thinking is, why don't we leverage Couchbase for this? 


![image](https://github.com/user-attachments/assets/d5941320-fc06-431a-bffb-6ff8778a4e54)


<br><br>




## Setup


<br><br>


Set up a Couchbase cluster with the following service groups. If you are not familiar with Couchbase cluster setup, follow [this](https://docs.couchbase.com/server/current/manage/manage-nodes/create-cluster.html). I'm using 5 virtual machines X 8vCPU & 32GB of memory, with the following Service Group configuration: 

Service Group 1: 
- Data + Index + Query   
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


Run the script for setting up GSI (global secondary index) and the initial documents needed as document triggers 
```
python3 setupdata.py 
```

<br><br>


## Couchbase Tour

<br>

Right now we have almost everything we need to get the engine running. Log in Couchbase cluter, go to **Eventing** tab, and Deploy all 3 functions. 


![image](https://github.com/user-attachments/assets/750e5304-76ab-4719-94be-a0f6cc9afe09)


<br>

Go to Documents tab, 


