// const util = require('./dynamodb-utility');
const util = require('../dist');
const dataModel = new util.DynamodbUtil('Static-Data');

dataModel.scan().then(res => console.log(res));

dataModel.put({_pkey: 'Test', _skey: 'Test-1'}, {
  location: 'Thailand',
})
