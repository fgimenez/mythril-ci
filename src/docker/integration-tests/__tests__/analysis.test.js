import _ from 'lodash';
import httpStatus from 'http-status';
import {serverRequest, makeUserUnlimited, getValidCredential, waitAnalysisStatus} from '../utils';

describe('/v1/analyses', () => {
  describe('Submit', () => {
    let data;

    beforeEach(() => {
      data = {
        contractName: 'TestMe',
        bytecode: '00',
        deployedBytecode: '00',
        sourceMap: '25:78:1:-;;;;8:9:-1;5:2;;;30:1;27;20:12;5:2;25:78:1;;;;;;;',
        deployedSourceMap: '25:78:1:-;;;;8:9:-1;5:2;;;30:1;27;20:12;5:2;25:78:1;;;;;;;',
        sourceList: [
          'basecontract.sol',
          'maincontract.sol',
        ],
        sources: {
          'basecontract.sol': '[... escaped source code ...]',
          'maincontract.sol': '[... escaped source code ...]',
        },
        analysisMode: 'full',
        abi: [],
      };
    });

    it('post analysis without authorization', async () => {
      data.deployedBytecode = 'abcc';
      const res = await serverRequest
        .post('/v1/analyses')
        .send({data})
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body.status).toBe(httpStatus.UNAUTHORIZED);
    });

    it('get analysis status without authorization', async () => {
      const res = await serverRequest
        .get('/v1/analyses/notexist')
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body.status).toBe(httpStatus.UNAUTHORIZED);
    });

    it('get analysis issues without authorization', async () => {
      const res = await serverRequest
        .get('/v1/analyses/notexist/issues')
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body.status).toBe(httpStatus.UNAUTHORIZED);
    });

    it('no issues', async () => {
      const {email, token} = await getValidCredential();
      await makeUserUnlimited(email);

      data.deployedBytecode = 'abcc';
      console.log('data:', data)
      let res = await serverRequest
        .post('/v1/analyses')
        .set('Authorization', `Bearer ${token}`)
        .send({data})
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('uuid');

      await waitAnalysisStatus(res.body.uuid, 'Finished', token);

      res = await serverRequest
        .get(`/v1/analyses/${res.body.uuid}/issues`)
        .set('Authorization', `Bearer ${token}`)
        .expect(httpStatus.OK);

      const foundIssues = res.body;
      expect(foundIssues).toBeInstanceOf(Array);
      expect(foundIssues.length).toBe(0);
    });

    it('error', async () => {
      const {email, token} = await getValidCredential();
      await makeUserUnlimited(email);

      data.deployedBytecode = '01';
      const res = await serverRequest
        .post('/v1/analyses')
        .set('Authorization', `Bearer ${token}`)
        .send({data})
        .expect(httpStatus.OK);
      expect(res.body).toHaveProperty('uuid');
    });

    it('issues', async () => {
      const {email, token} = await getValidCredential();
      await makeUserUnlimited(email);

      data.deployedBytecode = '60606040526004361061006c576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff168062362a951461006e57806327e235e31461009c5780632e1a7d4d146100e957806370a082311461010c5780638529587714610159575b005b61009a600480803573ffffffffffffffffffffffffffffffffffffffff169060200190919050506101ae565b005b34156100a757600080fd5b6100d3600480803573ffffffffffffffffffffffffffffffffffffffff169060200190919050506101fd565b6040518082815260200191505060405180910390f35b34156100f457600080fd5b61010a6004808035906020019091905050610215565b005b341561011757600080fd5b610143600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190505061033e565b6040518082815260200191505060405180910390f35b341561016457600080fd5b61016c610386565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b346000808373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254019250508190555050565b60006020528060005260406000206000915090505481565b806000803373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020541015156102da573373ffffffffffffffffffffffffffffffffffffffff168160405160006040518083038185876187965a03f19250505050806000803373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825403925050819055505b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166001604051808260ff16815260200191505060006040518083038160008661646e5a03f19150505050565b60008060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16815600a165627a7a7230582064223a1082bfbb3bb4a508b17a422e90fced0582c3905e1bfbf384e91f6ac7d40029';
      let res = await serverRequest
        .post('/v1/analyses')
        .set('Authorization', `Bearer ${token}`)
        .send({data})
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('uuid');

      await waitAnalysisStatus(res.body.uuid, 'Finished', token);

      res = await serverRequest
        .get(`/v1/analyses/${res.body.uuid}/issues`)
        .set('Authorization', `Bearer ${token}`)
        .expect(httpStatus.OK);

      const issues = res.body.map((issue) => _.omit(issue, 'debug'));

      expect(issues).toMatchSnapshot();
    });
  });
});
