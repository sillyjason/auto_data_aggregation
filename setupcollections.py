import os
import requests
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth
from sharedfunctions.print import print_success, print_error

load_dotenv()

#get the environment variables
EE_HOSTNAME = os.getenv("EE_HOSTNAME")
EVENTING_HOSTNAME = os.getenv("EVENTING_HOSTNAME")
SEARCH_HOSTNAME = os.getenv("SEARCH_HOSTNAME")
CB_USERNAME = os.getenv("CB_USERNAME")
CB_PASSWORD = os.getenv("CB_PASSWORD")


print("start setting up data structures..")

# create buckets, scopes and collections
def create_bucket(bucket_name, ram_quota): 
    url = f"http://{EE_HOSTNAME}:8091/pools/default/buckets"
    
    body = {
        'name': bucket_name,
        'ramQuota': ram_quota,
        'bucketType': 'couchbase',
        'flushEnabled': 1
    }
    
    response = requests.post(url, auth=HTTPBasicAuth(os.getenv("CB_USERNAME"), os.getenv("CB_PASSWORD")), data=body)

    success_code = 202
    if response.status_code == success_code:
        print_success(f"Created bucket '{bucket_name}'")
        return True
    
    else:
        print_error(f"Error creating bucket {bucket_name}: {response.text}")
        return None


def create_scope(scope_name, bucket_name):
    url = f"http://{EE_HOSTNAME}:8091/pools/default/buckets/{bucket_name}/scopes"
    response = requests.post(url, auth=HTTPBasicAuth(os.getenv("CB_USERNAME"), os.getenv("CB_PASSWORD")), data={"name": scope_name})
    success_code = 200
    if response.status_code == success_code:
        print_success(f"Created scope '{bucket_name}.{scope_name}'")
        return True
    else:
        print_error(f"Error creating scope {scope_name}: {response.text}")
        return False


def create_collection(bucket_name, scope_name, collection_name):
    url = f"http://{EE_HOSTNAME}:8091/pools/default/buckets/{bucket_name}/scopes/{scope_name}/collections"
    response = requests.post(url, auth=HTTPBasicAuth(os.getenv("CB_USERNAME"), os.getenv("CB_PASSWORD")), data={"name": collection_name})
 
    success_code = 200
    if response.status_code == success_code:
        print_success(f"Created collection '{bucket_name}.{scope_name}.{collection_name}'")
        return True
    else:
        print_error(f"Error creating colletion {collection_name}: {response.text}")
        return False


#create bucket main 
BUCKET_MAIN_ID = create_bucket("main", 15000)

#create bucket eventing
BUCKET_EVENTING_ID = create_bucket("eventing", 200)

if BUCKET_MAIN_ID is not None:
    scope_data_created = create_scope("data", "main") 
    scope_aggregation_created = create_scope("aggregation", "main")
    
    if scope_data_created:
        create_collection("main", "data", "data")
        create_collection("main", "data", "temp")

    if scope_aggregation_created:
        create_collection("main", "aggregation", "minute")


if BUCKET_EVENTING_ID is not None:
    create_collection("eventing", "_default", "one_off_trigger_one")
    create_collection("eventing", "_default", "one_off_trigger_two")


print_success("Done setting up data structures..")
