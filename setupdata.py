import os
from dotenv import load_dotenv
from couchbaseops import run_query, insert_doc
from sharedfunctions.print import print_success

load_dotenv()

# get the environment variables
EE_HOSTNAME = os.getenv("EE_HOSTNAME")
EVENTING_HOSTNAME = os.getenv("EVENTING_HOSTNAME")
CB_USERNAME = os.getenv("CB_USERNAME")
CB_PASSWORD = os.getenv("CB_PASSWORD")


# setup GSI 
run_query("create index data_client_creation_amount_category on `main`.`data`.`data`(`time_unix`, `amount`, `cust_type`)")
run_query("create index time_str on `main`.`data`.`data`(`time_str`)")


# initialize the 2 documents for triggering the recurring timers
trigger1_doc1 = {
  "active": True 
}

insert_doc('eventing', "_default", "one_off_trigger_one", trigger1_doc1, "trigger1_doc1")

print_success("setup complete.")