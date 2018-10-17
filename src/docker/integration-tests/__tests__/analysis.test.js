import _ from 'lodash';
import httpStatus from 'http-status';
import {serverRequest, makeUserUnlimited, getValidCredential, waitAnalysisStatus} from '../utils';
import submissionWithIssues from './submissionWithIssues';

describe('/v1/analyses', () => {
  describe('Submit', () => {
    let data;

    beforeEach(() => {
      data = {
        contractName: 'TestMe',
        abi: [
          {
            constant: false,
            inputs: [
              {
                name: 'first_input',
                type: 'uint256',
              },
            ],
            name: 'lol',
            outputs: [
              {
                name: '',
                type: 'uint256',
              },
            ],
            payable: false,
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ],
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
      };
    });

    it('post analysis without authorization', async () => {
      data.deployedBytecode = 'abcc';
      const res = await serverRequest
        .post('/v1/analyses')
        .send(data)
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
      let res = await serverRequest
        .post('/v1/analyses')
        .set('Authorization', `Bearer ${token}`)
        .send(data)
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
        .send(data)
        .expect(httpStatus.OK);
      expect(res.body).toHaveProperty('uuid');
    });

    it('issues', async () => {
      const {email, token} = await getValidCredential();
      await makeUserUnlimited(email);

      let res = await serverRequest
        .post('/v1/analyses')
        .set('Authorization', `Bearer ${token}`)
        .send(submissionWithIssues)
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
