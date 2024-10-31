function CreateRecurringTimer(context) {
    log('From CreateRecurringTimer: creating timer', context.mode, context.id);
    // Create a timestamp 60 seconds from now
    var sixtySecFromNow = new Date(); // Get current time & add 60 sec. to it.
    sixtySecFromNow.setSeconds(sixtySecFromNow.getSeconds() + 60);
    // Create a document to use as out for our context
    createTimer(RecurringTimerCallback, sixtySecFromNow, context.id, context);
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function RecurringTimerCallback(context) {
    log('From RecurringTimerCallback: timer fired', context);
    // rearm the timer ASAP, to ensure timer keeps running in the event
    // of later  errors or script timeouts in later "recurring work".
    CreateRecurringTimer({ "id": context.id, "mode": "via_callback" });
    // do any sort of recurring work here, just update a date_stamp in a doc
    
    // run the aggregation query
    var results = 
    with n as (trunc(now_millis()/1000))
        ,o as (n%60)
        ,e as (n-o)
        ,s as (e-60)
    SELECT
        COUNT(1) AS count,
        AVG(`amount`) AS average_amt,
        SUM(`amount`) AS total_amt,
        {"silver": SUM(CASE WHEN cust_type = "silver" THEN 1 ELSE 0 END) ,
        "gold": SUM(CASE WHEN cust_type = "gold" THEN 1 ELSE 0 END),
        "platinum": SUM(CASE WHEN cust_type = "platinum" THEN 1 ELSE 0 END)
        } AS category,
        MILLIS_TO_STR(e * 1000) as end_time_fmt,
        MILLIS_TO_STR(s * 1000) as start_time_fmt,
        MILLIS_TO_STR(n * 1000) as trigger_time_fmt,
        e as end_time,
        s as start_time,
        n as trigger_time
    FROM `main`.`data`.`data`
    WHERE `time_unix` BETWEEN s AND e
    GROUP BY e, s, n;
    
    for (var item of results) {   // Stream results using 'for' iterator.
        const now = new Date();
        const time = now.toISOString().slice(0, 16).replace('T', ' ');
        log("time: ", time, "aggregation result: ", item)
        item['time'] = time
        var uuid = generateUUID()
        minute_collection[uuid] = item
    }
    
    results.close()
    
}

function OnUpdate(doc, meta) {
    // You would typically filter to mutations of interest
    if (doc.active === false) {
        if (cancelTimer(RecurringTimerCallback, meta.id)) {
            log('From OnUpdate: canceled active Timer, doc.active',
                doc.active, meta.id);
        } else {
            log('From OnUpdate: no active Timer to cancel, doc.active',
                doc.active, meta.id);
        }
    } else {
        log('From OnUpdate: create/overwrite doc.active', doc.active, meta.id);
        CreateRecurringTimer({  "id": meta.id, "mode": "via_onupdate" });
    }
}