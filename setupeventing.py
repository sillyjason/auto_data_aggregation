import os
import requests
from dotenv import load_dotenv
import json 
from sharedfunctions.print import print_success, print_error

load_dotenv()

#get the environment variables
EE_HOSTNAME = os.getenv("EE_HOSTNAME")
EVENTING_HOSTNAME = os.getenv("EVENTING_HOSTNAME")
SEARCH_HOSTNAME = os.getenv("SEARCH_HOSTNAME")
CB_USERNAME = os.getenv("CB_USERNAME")
CB_PASSWORD = os.getenv("CB_PASSWORD")



# setup Eventing functions 
def import_function(function_name):
     
    print(f"Importing function {function_name}...")
    
    try:
        url = f"http://{EVENTING_HOSTNAME}:8096/api/v1/functions/{function_name}"

        with open(f'./eventing/{function_name}.json', 'r') as file:
            data = json.load(file)
                    
        response = requests.post(url, json=data, auth=(CB_USERNAME, CB_PASSWORD))
        response.raise_for_status()

        print_success(f"Function {function_name} imported successfully")
    
    except Exception as e:
        print_error(f"Error importing function {function_name}: {str(e)}")


import_function("recur_aggregation_trigger")
import_function("recur_final_ingestion")
import_function("recurr_ingestion_trigger")

