import uuid 
from couchbaseops import insert_doc
from concurrent.futures import ThreadPoolExecutor
import time
import random
from datetime import datetime, timezone
from couchbaseops import print_success  

INSERTS_PER_SECOND = 1000

def insert_document():
    key = str(uuid.uuid4())

    # get current UTC time in the string format of  
    
    value = {
        "time_unix": int(time.time() * 1000), # client time in milliseconds
        "time_str": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"), # client time in string format up to seconds
        "time_str_trunc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M"), # client time in string format up to minutes
        "user_id": f"user{random.randint(1, 100)}", # random user id
        "amount": 100, # random amount
        "cust_type": random.choice(["silver", "gold", "platinum"]) # random customer type
    }
    
    try:
        insert_doc("main", "data", "data", value, key, True)
    except Exception as e:
        print(f"Error inserting document: {e}")

# Function to perform inserts
def perform_inserts():
    with ThreadPoolExecutor(max_workers=1000) as executor:
        futures = [executor.submit(insert_document) for _ in range(INSERTS_PER_SECOND)]
        for future in futures:
            future.result()


# Schedule inserts every second
while True:
    start_time = time.time()
    perform_inserts()
    print_success(f"Inserted {INSERTS_PER_SECOND} documents.")
    elapsed_time = time.time() - start_time
    sleep_time = max(0, 1 - elapsed_time)
    time.sleep(sleep_time)