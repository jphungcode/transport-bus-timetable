const express = require("express");
const axios = require("axios");
const GtfsRealtimeBindings = require("gtfs-realtime-bindings");
const cors = require("cors");
const strtotime = require("locutus/php/datetime/strtotime");
const bodyParser = require("body-parser");
const app = express();
const path = require("path");
require("dotenv").config();

app.use(express.json());
app.use(cors({}));

app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

app.use(express.static(path.join(__dirname, "build")));

const url = "https://api.transport.nsw.gov.au/v1/gtfs/vehiclepos/buses";
const apikey = "VS0erNmHzpblgvtppvJnCCbUu2YsqjW5ZNgU";
const url_tripUpdate =
  "https://api.transport.nsw.gov.au/v1/gtfs/realtime/buses";
const url_busTimeTable =
  "https://api.transport.nsw.gov.au/v1/gtfs/schedule/buses/SMBSC004";

const stopFinderURI = "https://api.transport.nsw.gov.au/v1/tp/stop_finder";
const tripURI = "https://api.transport.nsw.gov.au/v1/tp/trip";
const departureURI = "https://api.transport.nsw.gov.au/v1/tp/departure_mon";

requestHeaderBuffer = {
  headers: { Authorization: `apikey ${apikey}` },
  responseType: "arraybuffer"
};

requestHeaderJSON = {
  headers: {
    Authorization: `apikey ${apikey}`,
    "Content-Type": "application/json"
  }
};

app.get("/api/trip", async (req, res) => {
  //let destinationName = req.body.destinationName;
  //console.log(req.query.id);
  let destinationName = req.query.destination;
  let data = {
    originID: "10111097",
    destinationID: "",
    originCoords: [],
    destinationCoords: [],
    tripInfo: []
  };
  let stopFinderParams = {
    outputFormat: "rapidJSON",
    odvSugMacro: 1,
    type_sf: "any",
    name_sf: destinationName,
    coordOutputFormat: "EPSG:4326",
    TfNSWSF: "true",
    anyMaxSizeHitList: 5
  };

  let tripParams = {
    outputFormat: "rapidJSON",
    coordOutputFormat: "EPSG:4326",
    depArrMacro: "dep",
    itdDate: getDate(),
    itdTime: getTime(),
    type_origin: "stop",
    name_origin: "10111097",
    type_destination: "stop",
    name_destination: "10101100",
    TfNSWTR: "true"
  };

  const stopQuery = http_query_build(stopFinderParams);
  try {
    let stopInfo = await getStopID(stopQuery);
    tripParams.name_destination = stopInfo[0];
    let tripQuery = http_query_build(tripParams);
    let tripInfo = await getTrip(tripQuery);
    data.destinationID = stopInfo[0];
    data.destinationCoords = stopInfo[1];
    data.tripInfo = tripInfo;

    res.json(data);
  } catch (error) {
    console.log(error);
  }
});

app.get("/api/departures", async (req, res) => {
  let departureParams = {
    outputFormat: "rapidJSON",
    coordOutputFormat: "EPSG:4326",
    mode: "direct",
    type_dm: "stop",
    name_dm: "10111097",
    depArrMacro: "dep",
    itdDate: getDate(),
    itdTime: getTime(),
    TfNSWTR: "true"
  };

  const departureQuery = http_query_build(departureParams);
  try {
    let departureInfo = await getDepartures(departureQuery);

    res.json(departureInfo);
  } catch (error) {
    console.log(error);
  }
});

app.get("/api/getBusLocation", (req, res) => {
  let realtimeId = req.query.realtimeId;
  console.log(realtimeId);

  if (realtimeId == undefined) {
    return res.status(400).json({ msg: "Real time id undefined" });
  }
  return axios
    .get(url, {
      headers: { Authorization: `apikey ${apikey}` },
      responseType: "arraybuffer"
    })
    .then(response => {
      var feed = GtfsRealtimeBindings.FeedMessage.decode(response.data);
      //console.log(feed);
      let tripID;
      let vehicleGPS;
      feed.entity.forEach(function(entity) {
        //console.log(entity.vehicle.position);

        tripID = entity.vehicle.trip.trip_id;
        //console.log(entity.vehicle);
        //console.log(entity.vehicle);
        if (realtimeId === tripID) {
          vehicleGPS = entity.vehicle.position;
          //console.log(typeof vehicleGPS);
          //console.log("found vehicle");
          //console.log(vehicleGPS);
          return res.json(vehicleGPS);
        }
      });
    })
    .catch(err => console.log(err));
});

function getDate() {
  let dt = new Date();
  let date =
    dt.getFullYear() +
    (dt.getMonth() + 1 < 10 ? "0" : "") +
    (dt.getMonth() + 1) +
    (dt.getDate() < 10 ? "0" : "") +
    dt.getDate();
  return date;
}

function getTime() {
  let dt = new Date();
  return `${dt.getHours()}${dt.getMinutes()}`;
}

function http_query_build(params) {
  let esc = encodeURIComponent;
  let query = Object.keys(params)
    .map(k => esc(k) + "=" + esc(params[k]))
    .join("&");
  return query;
}

// get stop ID for destination
function getStopID(query) {
  return axios
    .get(`${stopFinderURI}?${query}`, requestHeaderJSON)
    .then(response => {
      const stopLocation = response.data["locations"].filter(
        location => location.type === "stop"
      );
      //console.log(stopLocation[0].id);
      return [stopLocation[0].id, stopLocation[0].coord];
    })
    .catch(err => console.log(err));
}

function getTrip(query) {
  // get trip for departure to destination
  return axios
    .get(`${tripURI}?${query}`, requestHeaderJSON)
    .then(response => {
      let journeys = response.data["journeys"];
      return journeys[0].legs;
    })
    .catch(err => console.log(err));
}

function getDepartures(query) {
  let currentTime = Math.floor(new Date().getTime() / 1000);
  var transportation;
  var routeNumber;
  var destination;
  var description;
  var countdown;
  let departureTime;
  return axios
    .get(`${departureURI}?${query}`, requestHeaderJSON)
    .then(response => {
      if (response.data["stopEvents"] == undefined) {
        return console.log("API limit hit");
      }
      let stopEvents = response.data["stopEvents"];
      let data = [];
      let countdown;
      let depDate;
      let depHours;
      let depMinutes;
      let departureTime12;
      let minutes;
      let realtimeID;
      //  console.log(currentTime);
      stopEvents.forEach(stopEvent => {
        //console.log(stopEvent);
        if (stopEvent.transportation.destination.name.includes("Central")) {
          //console.log(stopEvent);
          stopLocation = stopEvent.location.coord;
          transportation = stopEvent.transportation;
          routeNumber = transportation.number;
          destination = transportation.destination.name;
          description = transportation.description;
          departureTime = strtotime(stopEvent.departureTimePlanned);
          countdown = departureTime - currentTime;
          depDate = new Date(departureTime * 1000);
          depHours = depDate.getHours();
          depMinutes = depDate.getMinutes();
          departureTime12 =
            depMinutes > 9
              ? `${depHours}:${depMinutes}`
              : `${depHours}:0${depMinutes}`;
          minutes = Math.round(countdown / 60);

          // get realtimetripID;
          realtimeID = stopEvent.properties.RealtimeTripId;
          //console.log(realtimeID);
          departureInfo = {
            countdown: minutes,
            route: routeNumber,
            destination: destination,
            description: description,
            departureTime: departureTime12,
            realtimeID: realtimeID,
            stopLocation: stopLocation
          };
          data = [...data, departureInfo];
        }
      });

      return data;
    })
    .catch(err => console.log(err));
}

function getBusLoc(trip_id) {
  return axios
    .get(url, {
      headers: { Authorization: `apikey ${apikey}` },
      responseType: "arraybuffer"
    })
    .then(response => {
      var feed = GtfsRealtimeBindings.FeedMessage.decode(response.data);
      //console.log(feed);
      let tripID;
      let data = [];
      feed.entity.forEach(function(entity) {
        //console.log(entity.vehicle.position);

        tripID = entity.vehicle.trip.trip_id;
        //console.log(entity.vehicle);
        if (trip_id === tripID) {
          vehicleGPS = entity.vehicle.position;
          //console.log(typeof vehicleGPS);
          //console.log("found vehicle");
          console.log(vehicleGPS);
          data = [...data, vehicleGPS];
        }
        return data;
      });
    })
    .catch(err => console.log(err));
}

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Port running on ${port}`);
});
