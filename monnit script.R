get_monnit_data <- function() {

library(httr)
library(httr2)
library(jsonlite)
library(dplyr)
library(lubridate)
library(tidyr)
library(stringr)
library(purrr)

#MONNIT DIRECT ----

monnit_api_secret_key <- Sys.getenv("monnit_api_secret_key")
monnit_api_key_id <- Sys.getenv("monnit_api_key_id")

#we could get all possible gateways at EH2, JH etc but we only want SSH which is NetworkID = 6
##All sensors ----

monnit_url <- "https://146.87.171.55/json/SensorList"
monnit_queries <- list(NetworkID = "6")
monnit_full_url <- modify_url(monnit_url, query = monnit_queries)

#Weird thing happens here, because its an IP not domain name something blocks it as windows sees
#IP instead of a domain name so refused to connect to it, the last part of this basically tells R to not check certificate
monnit_response <- GET(url = monnit_full_url, query = monnit_queries, 
                       add_headers(APIKeyID = monnit_api_key_id, 
                                   APISecretKey = monnit_api_secret_key), 
                       httr::config(ssl_verifypeer = FALSE, ssl_verifyhost = 0))

monnit_content <- fromJSON(content(monnit_response, as = "text"))

#finally get dataframe of all sensors on the SSH gateway
monnit_result <- as.data.frame(monnit_content$Result)
#^this could be the setup for live data as it gets the last reading from all sensors

##Get sensor data ----

#set time frame for data - this fixes BST/GMT time zone issues
get_monnit_time <- function(local_time_str, tzone = "Europe/London") {
  #Parse the local time (e.g., London)
  local_time <- as.POSIXct(local_time_str, tz = tzone)
  
  #Convert it to UTC
  utc_time <- local_time
  attr(utc_time, "tzone") <- "UTC"
  
  #Format it with slashes for Monnit's .NET parser
  #This automatically turns 00:00:00 BST into 23:00:00 UTC
  return(format(utc_time, "%Y/%m/%d %H:%M:%S"))
}

#Usage
#During BST (Summer), this will return "XXXX/YY/ZZ 23:00:00"
#During GMT (Winter), this will return "XXXX/YY/ZZ 00:00:00"
fromDate <- get_monnit_time(as.character(Sys.Date() -1))

#for live data we want data up to right now
toDate <- as.POSIXct(Sys.Date())

#list of all the sensors - to be iterated over
SensorID <- monnit_result$SensorID

#base url for 
monnit_sensor_url <- "https://146.87.171.55/json/SensorDataMessages"

#for our results set an empty list which we will add data to
##List of each sensor data ----
monnit_results <- list()

#for every sensor in the SensorID vector, get the data from the start to end date, and add to the empty list
#specify that we want each element in the list to be a dataframe for ease of use
#we get the timestamp - needs further parsing, and the data

#dont actually need the trycatch in this, but it makes it more robust
for (sensor in SensorID) {
  
  #tryCatch({ ... }, error = function(e) { ... }) — wraps the whole block so that if anything unexpected fails,
  #it catches the error, prints which sensor caused it and why, and continues the loop rather than stopping entirely.
  tryCatch({
    temp_monnit_url <- modify_url(url = monnit_sensor_url, query = list(SensorID = sensor, 
                                                                        fromDate = fromDate, 
                                                                        toDate = toDate))
    response <- GET(url = temp_monnit_url, 
                    add_headers(APIKeyID = monnit_api_key_id,
                                APISecretKey = monnit_api_secret_key),
                    httr::config(ssl_verifypeer = FALSE, ssl_verifyhost = 0))
    parsed <- fromJSON(httr::content(response, as = "text"))
    
    #is.null(parsed$Result) — checks if the API returned nothing at all for that sensor, 
    #which would cause data.frame() to fail.
    # || = OR
    #nrow(data.frame(parsed$Result)) == 0 — checks if the API returned an empty result set 
    #(a valid response but with no rows), which would cause mutate() to fail since there are no columns.
    if (is.null(parsed$Result) || nrow(data.frame(parsed$Result)) == 0) {
      message("Skipping sensor ", sensor, ": no data returned")
      
      #next — skips the rest of the current loop iteration and moves on to the next sensor,
      next
    }
    
    #make temporary dataframe to do some changes to first
    df <- data.frame(parsed$Result)
    
    #get messagedate to readable format
    df <- df %>% mutate(MessageDate = as.POSIXct(
      
      #turn it into a posix timestamp, divide by 1000 so its not in milliseconds - would give a year of like 20000
      as.numeric(str_match(MessageDate, "\\d+")) / 1000, 
      origin = "1970-01-01")) %>% 
      mutate(MessageDate = floor_date(MessageDate, unit = "10 minute"))
    
    #order the data from start to end, by default monnit goes most recent to oldest
    df <- df %>% arrange(MessageDate) %>% select(c(3,8,16))
    
    #store temporary dataframe into monnit_results list
    monnit_results[[as.character(sensor)]] <- df
    
  })
}

#give the list easier to read names - how we see them on monnit
names(monnit_results)
names(monnit_results) <- monnit_result$SensorName[match(as.numeric(names(monnit_results)), 
                                                        monnit_result$SensorID)]
names(monnit_results)
# #the monnit data is in an odd format - see below
# "Humidity|Celsius|DewPoint|GramsPerKilogram|HeatIndex_Celsius|WetBulb_Celsius"
# "42.53,22.45,9.1,51.1,21.9,14.7"

##Temperature Dataframes ----

#grab only the temperature sensors - list form so we use keep()
monnit_temps <- monnit_results %>% keep(str_detect(names(monnit_results), regex("Humidity", ignore_case = TRUE)))

#split the data from "42.53,22.45,9.1,51.1,21.9,14.7" into seperate columns
#lapply (list apply) separate function on every element
monnit_temps <- lapply(monnit_temps, function(df){
  df %>% separate(Data, into = c("Humidity", "Temperature", "DewPoint", "GramsPerKilogram", "HeatIndex_Celsius", "WetBulb_Celsius"), 
                  sep = ",",
                  convert = TRUE)
})

#Put all temperatures into one df, same for humidity, etc

###Humidity ----
monnit_humidity_df <- imap(monnit_temps, function(df, sensor_name) {
  df %>%
    select(MessageDate = 1, value = 2) %>%
    rename(!!sub("Humidity - ", "Humidity - ", sensor_name) := value)}) %>%
  reduce(full_join, by = "MessageDate") %>%
  arrange(MessageDate)

###Temperature ----
monnit_temperature_df <- imap(monnit_temps, function(df, sensor_name) {
  df %>%
    select(MessageDate = 1, value = 3) %>%
    rename(!!sub("Humidity - ", "Temperature - ", sensor_name) := value)}) %>%
  reduce(full_join, by = "MessageDate") %>%
  arrange(MessageDate)

###Dew Point ----
monnit_dewpoint_df <- imap(monnit_temps, function(df, sensor_name) {
  df %>%
    select(MessageDate = 1, value = 4) %>%
    rename(!!sub("Humidity - ", "Dewpoint - ", sensor_name) := value)}) %>%
  reduce(full_join, by = "MessageDate") %>%
  arrange(MessageDate)

###Grams per kilogram ----
monnit_gpkg_df <- imap(monnit_temps, function(df, sensor_name) {
  df %>%
    select(MessageDate = 1, value = 5) %>%
    rename(!!sub("Humidity - ", "gpkg - ", sensor_name) := value)}) %>%
  reduce(full_join, by = "MessageDate") %>%
  arrange(MessageDate)

###Heat index - Celcius ----
monnit_heatindex_df <- imap(monnit_temps, function(df, sensor_name) {
  df %>%
    select(MessageDate = 1, value = 6) %>%
    rename(!!sub("Humidity - ", "Heat Index - ", sensor_name) := value)}) %>%
  reduce(full_join, by = "MessageDate") %>%
  arrange(MessageDate)

###Wet Bulb - Celcius ----
monnit_wetbulb_df <- imap(monnit_temps, function(df, sensor_name) {
  df %>%
    select(MessageDate = 1, value = 7) %>%
    rename(!!sub("Humidity - ", "Wet Bulb - ", sensor_name) := value)}) %>%
  reduce(full_join, by = "MessageDate") %>%
  arrange(MessageDate)

##Current Dataframe & plots ----

##Only current sensors from our master list
monnit_current <- monnit_results %>% keep(str_detect(names(monnit_results), regex("Current", ignore_case = TRUE)))

#split the data from "42.53,22.45,9.1,51.1,21.9,14.7" into seperate columns
#lapply (list apply) separate function on every element
monnit_current <- lapply(monnit_current, function(df){
  df %>% separate(Data, into = c("Amp hours","Average current","Maximum current","Minimum current"), 
                  sep = ",",
                  convert = TRUE)
})

monnit_current_df <- data.frame(monnit_current)

# Remove a fixed prefix
names(monnit_current_df) <- sub("^Current.Meter.150.Amp...527421.", "Current - ", names(monnit_current_df))

colnames(monnit_current_df)[1] <- "MessageDate"

monnit_current_df <- monnit_current_df[,-6]

#remove the . too
names(monnit_current_df) <- sub("\\.", " ", names(monnit_current_df))

#one df
df_list <- list(monnit_current_df, monnit_dewpoint_df, monnit_gpkg_df, monnit_heatindex_df, monnit_humidity_df, monnit_temperature_df, monnit_wetbulb_df)

joined_monnit_df <- df_list %>% reduce(full_join) %>% arrange(MessageDate)

joined_monnit_df
}
