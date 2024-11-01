import threading
import datetime
import time 
from couchbaseops import run_query

# Step 2: Define the function to be called by the timer
def my_function():
    print("Timer fired! Function executed.")
    # Step 5: Set up the timer to fire again at the beginning of the next minute
    
    # print out current time, formatted under current
    current_time_millis = int(time.time() * 1000)    
    print('current_time_millis:', current_time_millis)
    
    # compose and run the query
    query = """
    INSERT INTO `main`.`aggregation`.`minute_api` (KEY k, VALUE v)
    SELECT v.start_time k, v
    FROM
    (
        with n as (trunc(now_millis()/1000))
            ,o as (n%60)
            ,e as (n-o)
            ,s as (e-60)
        SELECT
            DATE_TRUNC_STR(DATE_ADD_STR(NOW_STR(),-1,"minute"),"minute") AS start_time,
            DATE_TRUNC_STR(NOW_STR(),"second") AS trigger_time,
            COUNT(1) AS count,
            AVG(`amount`) AS average_amt,
            SUM(`amount`) AS total_amt,
            {"sliver": SUM(CASE WHEN cust_type = "silver" THEN 1 ELSE 0 END) ,
            "gold": SUM(CASE WHEN cust_type = "gold" THEN 1 ELSE 0 END),
            "platinum": SUM(CASE WHEN cust_type = "platinum" THEN 1 ELSE 0 END)
            } AS category
        FROM `main`.`data`.`data`
        WHERE `time_unix` BETWEEN s AND e
    ) v
    """
    
    result = run_query(query)
    # print('result: ', result)
    
    # print time difference
    post_time_millis = int(time.time() * 1000)    
    print('post_time_millis:', post_time_millis, "time_taken: ", post_time_millis - current_time_millis)
    
    schedule_next_minute()


# Step 3: Define the function to schedule the next timer
def schedule_next_minute():
    now = datetime.datetime.now()
    # Calculate the time until the next minute starts
    seconds_until_next_minute = 60 - now.second
    # Create a timer to fire at the beginning of the next minute
    timer = threading.Timer(seconds_until_next_minute, my_function)
    timer.start()


# Step 4: Schedule the first timer
schedule_next_minute()

print("Timer started. Waiting for it to fire at the beginning of every minute...")