#!/usr/bin/env node

'use strict';

const Path = require('path');

var neo4j = require('neo4j-driver').v1;

var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic(process.env.NEO4J_UID, process.env.NEO4J_PWD));

driver.onCompleted = function() {
  console.log('Successfully connected to Neo4J');
};

driver.onError = function(error) {
  console.log('Neo4J Driver instantiation failed', error);
};

var session = driver.session();

var client = require('seneca')()
  .use('seneca-amqp-transport')
  .client({
    type: 'amqp',
    pin: 'cmd:getNode,cuid:*,depth:*',
    url: process.env.AMQP_URL
  });

require('seneca')()
  .use('seneca-amqp-transport')
  .add('cmd:getNode,route:*,depth:*', function(message, done) {
    var queryString = "MATCH (startNode:Route { cuid: '" + message.route + "' }) -[relation:ROUTES_TO]-> (childNode) RETURN childNode";
    console.log(queryString);
    session
      .run(queryString)
      .then(function(result) {
        session.close();
        console.log(result.records[0]._fields);
        var msg = "cmd:getNode,cuid:" + result.records[0].get('childNode').properties.cuid + ",depth:" + message.depth;
        console.log(msg);
        client.act(msg, (err, res) => {
          if (err) {
            throw err;
          }
          return done(null, res);
        });

      })
      .catch(function(error) {
        console.log(error);
      });
  })
  .listen({
    type: 'amqp',
    pin: 'cmd:getNode,route:*,depth:*',
    url: process.env.AMQP_URL
  });
