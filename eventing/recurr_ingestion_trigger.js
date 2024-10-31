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
    var count = context.count;
    CreateRecurringTimer({ "id": context.id, "mode": "via_callback", "count": count });
    // do any sort of recurring work here, just update a date_stamp in a doc
    
    // generate temp documents in a loop
    for (let i = 0; i < count; i++) {
        var uuid = generateUUID()
        temp_collection[uuid] = {"count": count}
    }
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
        
        // initiate the doc count for triggering data ingestion loop iterations 
        var count = 100 
        if ( doc.count ) { 
            count = doc.count
        }
        
        CreateRecurringTimer({  "id": meta.id, "mode": "via_onupdate", "count": count });
    }
}