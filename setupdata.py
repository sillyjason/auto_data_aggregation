import os
from dotenv import load_dotenv
from couchbaseops import run_query, insert_doc
from sharedfunctions.print import print_success

load_dotenv()

#get the environment variables
EE_HOSTNAME = os.getenv("EE_HOSTNAME")
EVENTING_HOSTNAME = os.getenv("EVENTING_HOSTNAME")
SEARCH_HOSTNAME = os.getenv("SEARCH_HOSTNAME")
CB_USERNAME = os.getenv("CB_USERNAME")
CB_PASSWORD = os.getenv("CB_PASSWORD")


# setup GSI on `time_unix` field
run_query("CREATE INDEX `doc_timeunix` ON `main`. `data`.`data`(`time_unix`)")


# initialize the 2 documents for triggering the recurring timers
trigger1_doc1 = {
  "count": 300,
  "active": False 
}

insert_doc('eventing', "_default", "one_off_trigger_one", trigger1_doc1)

trigger1_doc2 = {
  "active": False 
}

insert_doc('eventing', "_default", "one_off_trigger_two", trigger1_doc2)



print_success("setup complete.")