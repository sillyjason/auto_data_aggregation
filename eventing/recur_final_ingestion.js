function generateData() {
    const custTypes = ["silver", "gold", "platinum"];

    const now = new Date();
    const time = now.toISOString().slice(0, 16).replace('T', ' ');
    const timeUnix = Math.floor(now.getTime() / 1000);
    const userId = Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
    const amount = Math.floor(Math.random() * (999 - 10 + 1)) + 10;
    const custType = custTypes[Math.floor(Math.random() * custTypes.length)];

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
        data_collection[uuid] = generateData()
    }
}
