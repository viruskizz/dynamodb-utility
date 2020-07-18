const {DynamodbUtil} = require('dynamodb-utility');
// import {DynamodbUtil} from 'dynamodb-utility';

const userModel = new DynamodbUtil('User-Table', {
  region: 'ap-southeast-1',
});

dataModel.scan().then(res => console.log(res));

const newUser = userModel.put({
  pkey: 'User1',
  skey: 'Profile',
  firstname: 'Araiva',
  lastname: 'Viruskizz',
  gender: 'Male',
  age: 20,
  address: {
    province: 'London',
    country: 'England'
  }
}).then(res => console.log(res));

const user = userModel.get({ pkey: 'User1', skey: 'Profile'})
  .then(res => console.log(res));

const updateUser = userModel.update({ id: 'User1', skey: 'Profile'}, {
  age: 35
}).then(res => console.log(res));

const deletedUser = userModel.delete({ pkey: 'User1', skey: 'Profile' })
  .then(res => console.log(res));

const users = userModel.scan({
  filter: {
    gender: 'Male',
    age: {
      greaterThan: 10
    },
    'address.country': 'England',
  },
  attributes: ['firstname', 'lastname', 'age']
}).then(res => console.log(res));

const profileUser = userModel.query({
  keyCondition: {
    pkey: 'User1',
    skey: {
      beginsWith: 'Profile'
    }
  }
}).then(res => console.log(res));
