import {DynamodbUtil} from '../index';
import {DocumentClient} from 'aws-sdk/clients/dynamodb'

const docClient = new DocumentClient({
  region: 'ap-southeast-1'
});
const TABLE = 'Static-Table';
const dataModel = new DynamodbUtil('Static-Table', {
  region: 'ap-southeast-1'
});
beforeAll(() => initDatabase());
afterAll(() => clearDatabase());

// const dynamodb = new DynamodbUtil()

describe('DynamoDBUtil Test Suite', () => {
  describe('jest testing', () => {
    test('simple test', async () => {
      expect(1).toBe(1);
      // const result = await dataModel.scan({
      //   filter: {
      //     _pkey: 'Album1'
      //   },
      //   attributes: ['artist', '_pkey'],
      // });
      // console.log(result);
    });

  });

  describe('attributes projection test', () => {
    test('scan with attributes', async () => {
      const result = await dataModel.scan({
        filter: {
          _pkey: 'Album1'
        },
        attributes: ['artist', '_pkey'],
      });
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ _pkey: 'Album1', artist: expect.any(String) })
      ]));
    });
    test('query with attributes', async () => {
      const result = await dataModel.query({
        keyCondition: {
          _pkey: 'Album1'
        },
        attributes: ['artist', '_pkey', 'attribute.duration'],
      });
      console.log(result);
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ _pkey: 'Album1', artist: expect.any(String) })
      ]));
    });
  });

  describe('raw documentClient testing', () => {
    test('scan by raw', async () => {
      const result = await dataModel.raw.scan({
        TableName: 'Static-Table',
      }).promise();
      // console.log(result);
      expect(result.Items).toEqual(expect.arrayContaining([
        expect.objectContaining({ _pkey: 'Album2',  _skey: 'Album2#Araiva#Track1' })
      ]));
    });
  });

  describe('query test', () => {
    test('query with function beginsWith', async () => {
      const result = await dataModel.query({
        keyCondition: {
          _pkey: 'Album1',
          _skey: {
            beginsWith: 'Album1#Araiva'
          }
        }
      });
      // expect(result).toContain([
      //   expect.objectContaining({ _pkey: 'Album1', _skey: 'Album1#Araiva#Track1' }),
      //   expect.objectContaining({ _pkey: 'Album1', _skey: 'Album1#Araiva#Track2' }),
      //   expect.objectContaining({ _pkey: 'Album1', _skey: 'Album1#Araiva#Track3' })
      // ]);
      expect(result).toHaveLength(3);
    });

    test('query with function beginsWith and filter', async () => {
      const result = await dataModel.query({
        keyCondition: {
          _pkey: 'Album1',
          _skey: {
            beginsWith: 'Album1#Araiva'
          }
        },
        filter: {
          ['song']: 'song theme 12'
        }
      });
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ _pkey: 'Album1',  _skey: 'Album1#Araiva#Track2' })
      ]));
      expect(result).toHaveLength(1);
    });

    test('query with sort DESC', async () => {
      const result = await dataModel.query({
        keyCondition: {
          _pkey: 'Album1',
        },
        sort: 'DESC'
      });
      expect(result[0]).toMatchObject({
        _pkey: 'Album1',
        _skey: 'Album1#Virus#Track5'
      })
    });

    test('query with attributes DESC', async () => {
      const result = await dataModel.query({
        keyCondition: {
          _pkey: 'Album1',
        },
        attributes: ['artist']
      });
      expect(result[0]).toMatchObject({
        artist: expect.any(String),
      })
    });
  });

  describe('scan', () => {
    test('scan with function equal and nested object', async () => {
      const result = await dataModel.scan({
        filter: {
          ['artist']: 'Araiva',
          ['attribute.country']: 'Japan'
        }
      });
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ _pkey: 'Album1',  _skey: 'Album1#Araiva#Track3' })
      ]));
      expect(result).toHaveLength(1);
    });

    test('scan with function contains', async () => {
      const result = await dataModel.scan({
        filter: {
          _skey: {
            contains: 'Virus'
          },
        }
      });
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ artist: 'Virus'})
      ]));
      expect(result).toHaveLength(3);
    });

    test('scan with lastKey', async () => {
      const result = await dataModel.scan({
        lastKey: {
          _pkey: 'TestPopulation',
          _skey: 'TestPopulation-1'
        },
        limit: 3
      });
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining(
          {_pkey: 'TestPopulation', _skey: 'TestPopulation-2' }
        )
      ]));
    });
  });

  describe('update testing', () => {
    test('update add new body', async () => {
      const key = {_pkey: 'TestPopulation', _skey: 'TestPopulation-1'};
      const body = {
        man: 5000,
        woman: 1000
      };
      const result = await dataModel.update(key, body);
      // expected return
      expect(result).toMatchObject({ ...key, ...body });

      // expected database updated
      const data = await docClient.get({TableName: TABLE, Key: key}).promise();
      expect(data.Item).toMatchObject({ ...key, ...body });
      expect(data.Item).toHaveProperty('country');
      expect(data.Item).toHaveProperty('population');
    });
  });

  describe('patch testing', () => {
    test('patch nest attribute', async () => {
      const key = {_pkey: 'Album1', _skey: 'Album1#Virus#Track4'};
      const duration =  200;
      const result = await dataModel.patch(key, {
        'attribute.duration': duration
      });
      // expected return
      expect(result).toMatchObject({ ...key});

      // expected database updated
      const data = await docClient.get({TableName: TABLE, Key: key}).promise();
      // console.log('updated Data: ', data)
      expect(data.Item?.artist).toBe('Virus');
      expect(data.Item?.attribute.duration).toBe(200);
      expect(data.Item?.attribute.country).toBe('Thailand');
    });

    test('patch nest attribute with array', async () => {
      const key = {_pkey: 'Album1', _skey: 'Album1#Virus#Track5'};
      const tags =  ['cc', 'dd'];
      const result = await dataModel.patch(key, {
        'attribute.tags': tags
      });
      // expected return
      expect(result).toMatchObject({ ...key});

      // expected database updated
      const data = await docClient.get({TableName: TABLE, Key: key}).promise();
      // console.log('updated Data: ', data)
      expect(data.Item?.artist).toBe('Virus');
      expect(data.Item?.attribute.tags).toContain('cc');
      expect(data.Item?.attribute.tags).toContain('dd');
      expect(data.Item?.attribute.country).toBe('England');
    });

    test('patch lv1 attribute', async () => {
      const key = {_pkey: 'Album2', _skey: 'Album2#Araiva#Track1'};
      const result = await dataModel.patch(key, {
        'artist': 'Virus'
      });
      // expected return
      expect(result).toMatchObject({ ...key});

      // expected database updated
      const data = await docClient.get({TableName: TABLE, Key: key}).promise();
      expect(data.Item?.artist).toBe('Virus');
    });
  })
});

const mock = require('./payloads/mock.json');

function initDatabase() {
  const params = {
    RequestItems: {
      'Static-Table': mock.map((el: any) => ({
        PutRequest: { Item: el }
      }))
    }
  };
  return docClient.batchWrite(params).promise()
}

function clearDatabase() {
  const params = {
    RequestItems: {
      'Static-Table': mock.map((el: any) => ({
        DeleteRequest: {
          Key: {
            _pkey: el._pkey,
            _skey: el._skey
          }
        }
      }))
    }
  };
  return docClient.batchWrite(params).promise()

}
