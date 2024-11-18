function updateAggregate(current_doc, transaction_doc, aggregation_meta, transaction_doc_id) {

    // update the document with the new transaction
    var new_count = current_doc.count + 1;
    var new_total_amt = current_doc.total_amt + transaction_doc.amount;
    var new_average_amt = new_total_amt / new_count;
    var new_transactions = []

    // if the transactions array is empty, create a new one
    if ( !current_doc.transactions || current_doc.transactions.length == 0 ) {
        new_transactions = [transaction_doc_id];
    } else {
        // append the new transaction to the existing transactions array
        new_transactions = [...current_doc.transactions, transaction_doc_id];
    }
    
    // write back to the same doc
    let res = couchbase.mutateIn(m_e_kv_users, aggregation_meta, [
        couchbase.MutateInSpec.replace("count", new_count),
        couchbase.MutateInSpec.replace("total_amt", new_total_amt),
        couchbase.MutateInSpec.replace("average_amt", new_average_amt),
        couchbase.MutateInSpec.replace("transactions", new_transactions),
      ]);
      
    return res;
}



function OnUpdate(doc, meta) {
    // assemble the to-be-inserted document key
    const user_id = doc.user_id;
    const doc_key = doc.time_str_trunc + '-' + user_id;
    
    // initialize the current_doc and aggregation_meta
    let current_doc = null;
    let aggregation_meta = { "id": doc_key };
    
    // get current document using Advanced INSERT ops to get the CAS value too
    var result = couchbase.get(m_e_kv_users, aggregation_meta);
        if (result.success) {
            current_doc = result.doc;
            aggregation_meta = result.meta;
    }
    
    // if the document does not exist, create it
    if (!current_doc) {
        current_doc = {
            "user_id": user_id,
            "count": 0,
            "total_amt": 0,
            "average_amt": 0,
            "transactions": []
        };

        couchbase.insert(m_e_kv_users, aggregation_meta, current_doc);

        // get current document using Advanced INSERT ops to get the CAS value too
        result = couchbase.get(m_e_kv_users, aggregation_meta);
        if (result.success) {
            current_doc = result.doc;
            aggregation_meta = result.meta;
        }
    }

    // use a while loop to keep retrying the operation until it succeeds
    // this is to handle the potential CAS mismatch issue
    // define the success flag and retry counter
    let success = false;
    let retry_counter = 0;

    while ( !success ) {
        // update the document with the new transaction
        var aggregate_result = updateAggregate(current_doc, doc, aggregation_meta, meta.id);
       
        if (aggregate_result.success) {
            // print the try_counter only if it's greater than 0
            if ( retry_counter > 0 ) {
                log("insert success at retry: ", retry_counter);
            }

            // set the success flag to true and exit the loop
            success = true; 
        }
        
        // increment the retry counter
        retry_counter++;
        
        // retry 
        var result = couchbase.get(m_e_kv_users, { "id": doc_key });
        if (result.success) {
            current_doc = result.doc;
            aggregation_meta = result.meta;
        }
    }
}
