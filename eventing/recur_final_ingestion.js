function generateData() {
    const custTypes = ["silver", "gold", "platinum"];

    //get random time between -30 and 30 seconds from now
    const now = new Date();
    const time = now.toISOString().slice(0, 16).replace('T', ' ');
    const timeUnix = Math.floor(now.getTime() / 1000);
    
    //generate random user_id, amount and cust_type
    const userId = Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
    const amount = Math.floor(Math.random() * (999 - 10 + 1)) + 10;
    const custType = custTypes[Math.floor(Math.random() * custTypes.length)];

    //create JSON object
    const jsonObject = {
        time: time,
        time_unix: timeUnix,
        user_id: userId,
        amount: amount,
        cust_type: custType
    };

    return jsonObject
} 

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


function OnUpdate(doc, meta) {
    var count = doc.count 
    
    for (let i = 0; i < count; i++) {
        var uuid = generateUUID()
        // generate final data in data collection "count" times
        
        try { 
            data_collection[uuid] = generateData()
        } catch(e) {
            log('Error generating data: ', e)
        }
    }
}
