import threading
import datetime
import time 
from couchbaseops import run_query, subdocument_upsert

# Step 2: Define the function to be called by the timer
def my_function():
    print("Timer fired! Function executed.")
    # Step 5: Set up the timer to fire again at the beginning of the next minute
    
    # print out current time, formatted under current
    current_time_millis = int(time.time() * 1000)    
    print('current_time_millis:', current_time_millis, "which is", current_time_millis%1000, "milliseconds past the second")
    
    # compose and run the query
    query = """
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
    """
    
    # run the query
    result = run_query(query, True)
    
    # extract the document key from query result
    doc_key = None
    
    for row in result:
        doc_key = row['start_time']
        break
    
    # run a subdocument upsert to update the task initiation time in milliseconds; 
    # this is to calculate the speed of couchbase being able to process the query
    if doc_key:
        subdocument_upsert("main", "aggregation", "minute_api", doc_key, "sender_task_start_time", current_time_millis)
    
    
    schedule_next_minute()


# Step 3: Define the function to schedule the next timer
def schedule_next_minute():
    now = datetime.datetime.now()
    # Calculate the time until the next minute starts
    milliseconds_until_next_minute = (60 - now.second) * 1000 - now.microsecond // 1000
    # Create a timer to fire at the beginning of the next minute
    timer = threading.Timer(milliseconds_until_next_minute / 1000, my_function)
    timer.start()


# Step 4: Schedule the first timer
schedule_next_minute()

print("Timer started. Waiting for it to fire at the beginning of every minute...")