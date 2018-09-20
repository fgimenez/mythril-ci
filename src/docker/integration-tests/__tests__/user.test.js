import httpStatus from 'http-status';
import {
  serverRequest,
  generateEmailAddress,
  getUserFromDatabase,
  registerAndActivateUser,
  loginUser,
  makeUserAdmin,
  registerUser,
  PASSWORD,
  getJwtFromDatabase,
} from '../utils';

describe('/mythril/v1/', () => {

  describe('register', () => {

    it('invalid email', async () => {
      const res = await serverRequest
        .post('/mythril/v1/users')
        .send({
          firstName: 'David',
          lastName: 'Martin',
          email: 'invalid',
          termsId: 'no_terms',
        })
        .expect(httpStatus.BAD_REQUEST);
      expect(res.body).toHaveProperty('status');
      expect(res.body.status).toBe(httpStatus.BAD_REQUEST);
    });

    it('another invalid email', async () => {
      const res = await serverRequest
        .post('/mythril/v1/users')
        .send({
          firstName: 'David',
          lastName: 'Martin',
          email: 'invalid@domain',
          termsId: 'no_terms',
        })
        .expect(httpStatus.BAD_REQUEST);
      expect(res.body).toHaveProperty('status');
      expect(res.body.status).toBe(httpStatus.BAD_REQUEST);
    });

    it('invalid terms', async () => {
      const email = generateEmailAddress();
      const res = await serverRequest
        .post('/mythril/v1/users')
        .send({
          firstName: 'David',
          lastName: 'Martin',
          email,
          termsId: 'invalid_terms',
        })
        .expect(httpStatus.BAD_REQUEST);
      expect(res.body).toHaveProperty('status');
      expect(res.body.status).toBe(httpStatus.BAD_REQUEST);
    });

    it('successful registration', async () => {
      const res = await serverRequest
        .post('/mythril/v1/users')
        .send({
          firstName: 'David',
          gReCaptcha: 'DummyReCaptcha',
          lastName: 'Martin',
          email: generateEmailAddress(),
          termsId: 'no_terms',
        })
        .expect(httpStatus.OK);
      expect(res.body).toHaveProperty('user');
    });

    it('fail on email exists', async () => {
      const email = await registerAndActivateUser();
      const res = await serverRequest
        .post('/mythril/v1/users')
        .send({
          firstName: 'David',
          gReCaptcha: 'DummyReCaptcha',
          lastName: 'Martin',
          email,
          termsId: 'no_terms',
        })
        .expect(httpStatus.BAD_REQUEST);
    });

    it('fail registration if non-admin user tries to register', async () => {
      const email = await registerAndActivateUser();
      const token = await loginUser(email);
      const res = await serverRequest
        .post('/mythril/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'David',
          gReCaptcha: 'DummyReCaptcha',
          lastName: 'Martin',
          email: generateEmailAddress(),
          termsId: 'no_terms',
        })
        .expect(httpStatus.UNAUTHORIZED);
    });

    it('Successful registration when admin user tries to register', async () => {
      const email = await registerAndActivateUser();
      await makeUserAdmin(email);
      const token = await loginUser(email);
      const res = await serverRequest
        .post('/mythril/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'David',
          gReCaptcha: 'DummyReCaptcha',
          lastName: 'Martin',
          email: generateEmailAddress(),
          termsId: 'no_terms',
        })
        .expect(httpStatus.OK);
      expect(res.body).toHaveProperty('user');
    });
  });

  describe('activate account', () => {

    it('fail on userId does not exist', async () => {
      const email = await registerUser();
      const res = await serverRequest
        .post('/mythril/v1/users/randomUserId/activate')
        .send({
          password: 'Delta@123',
          verificationCode: '123123123',
        }).expect(httpStatus.BAD_REQUEST);
    });

    it('fail on invalid password', async () => {
      const email = await registerUser();
      const user = await getUserFromDatabase(email);
      const res = await serverRequest
        .post(`/mythril/v1/users/${user._id}/activate`)
        .send({
          password: '123',
          verificationCode: user.verificationCode,
        }).expect(httpStatus.BAD_REQUEST);
    });

    it('successful verification', async () => {
      const email = await registerUser();
      const user = await getUserFromDatabase(email);
      const res = await serverRequest
        .post(`/mythril/v1/users/${user._id}/activate`)
        .send({
          password: 'Delta@123',
          verificationCode: user.verificationCode,
        }).expect(httpStatus.OK);
    });

    it('fail on reactivation', async () => {
      const email = await registerAndActivateUser();
      const user = await getUserFromDatabase(email);
      const res = await serverRequest
        .post(`/mythril/v1/users/${user._id}/activate`)
        .send({
          password: 'Delta@123',
          verificationCode: user.verificationCode,
        }).expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('recover account', () => {

    it('Success even when email is not registered', async () => {
      const res = await serverRequest
        .post('/mythril/v1/users/recover')
        .send({
          email: generateEmailAddress(),
        }).expect(httpStatus.OK);
    });

    it('Check the verification code and expiry', async () => {
      const email = await registerAndActivateUser();
      let user = await getUserFromDatabase(email);
      expect(user.verificationCode).toBeUndefined();
      const res = await serverRequest
        .post(`/mythril/v1/users/recover`)
        .send({
          email
        })
      expect(res.status).toBe(httpStatus.OK);
      user = await getUserFromDatabase(email);
      expect(user.verificationCode).toBeDefined();
    });
  });

  describe('login', () => {

    it('fail if wrong email is given', async () => {
      const email = await registerAndActivateUser();
      const res = await  serverRequest
        .post(`/mythril/v1/auth/login`)
        .send({
          email: generateEmailAddress(),
          password: PASSWORD,
        }).expect(httpStatus.BAD_REQUEST);
    });

    it('fail if wrong password is given', async () => {
      const email = await registerAndActivateUser();
      const res = await  serverRequest
        .post(`/mythril/v1/auth/login`)
        .send({
          email,
          password: 'asdasd@12312D',
        }).expect(httpStatus.BAD_REQUEST);
    });

    it('must return tokens on success', async () => {
      const email = await registerAndActivateUser();
      const res = await  serverRequest
        .post(`/mythril/v1/auth/login`)
        .send({
          email,
          password: PASSWORD,
        }).expect(httpStatus.OK);
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body).toHaveProperty('refreshToken');
    });

    it('must allow multiple active jwts', async () => {
      const email = await registerAndActivateUser();
      const user = await getUserFromDatabase(email);
      const tokens1 = (await  serverRequest
        .post(`/mythril/v1/auth/login`)
        .send({
          email,
          password: PASSWORD,
        })).body;
      const tokens2 = (await  serverRequest
        .post(`/mythril/v1/auth/login`)
        .send({
          email,
          password: PASSWORD,
        })).body;
        const jwt1 = await getJwtFromDatabase(tokens1.refreshToken);
        const jwt2 = await getJwtFromDatabase(tokens2.refreshToken);
        expect(jwt1).toBeDefined();
        expect(jwt1.userId).toBe(user._id);
        expect(jwt2).toBeDefined();
        expect(jwt2.userId).toBe(user._id);
    });
  });

  describe('logout', () => {

    it('fail on invalid access token', async () => {
      const email = await registerAndActivateUser();
      const token = await loginUser(email);
      await serverRequest
        .post('/mythril/v1/auth/logout')
        .expect(httpStatus.UNAUTHORIZED);
    });

    it('delete jwt from database on success', async () => {
      const email = await registerAndActivateUser();
      const tokens = (await  serverRequest
        .post(`/mythril/v1/auth/login`)
        .send({
          email,
          password: PASSWORD,
        })).body;
      await expect(
        getJwtFromDatabase(tokens.refreshToken)
      ).resolves.toBeDefined();
      await serverRequest
        .post('/mythril/v1/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(httpStatus.OK);
      await expect(
        getJwtFromDatabase(tokens.refreshToken)
      ).resolves.toBeNull();
    });
  });

  describe('refresh token', () => {
    let email;
    let refreshToken;
    let accessToken;

    beforeEach(async () => {
      email = await registerAndActivateUser();
      const tokens = (await  serverRequest
        .post(`/mythril/v1/auth/login`)
        .send({
          email,
          password: PASSWORD,
        })).body;
      refreshToken = tokens.refreshToken;
      accessToken = tokens.accessToken;
    });

    it('fail on incorrect access token', async () => {
      await serverRequest
        .post('/mythril/v1/auth/refresh')
        .send({
          accessToken: 'delta',
          refreshToken,
        }).expect(httpStatus.BAD_REQUEST);
    });

    it('fail on incorrect refresh token', async () => {
      await serverRequest
        .post('/mythril/v1/auth/refresh')
        .send({
          accessToken,
          refreshToken: 'delta',
        }).expect(httpStatus.BAD_REQUEST);
    });

    it('must return new tokens on success', async () => {
      const res = await serverRequest
        .post('/mythril/v1/auth/refresh')
        .send({
          accessToken,
          refreshToken,
        }).expect(httpStatus.OK);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('must revoke the old jwt from database', async () => {
      const res = await serverRequest
        .post('/mythril/v1/auth/refresh')
        .send({
          accessToken,
          refreshToken,
        }).expect(httpStatus.OK);
      await expect(
        getJwtFromDatabase(refreshToken)
      ).resolves.toBeNull();
    });

    it('must fail on reusing the old refresh tokens', async () => {
      const res = await serverRequest
        .post('/mythril/v1/auth/refresh')
        .send({
          accessToken,
          refreshToken,
        }).expect(httpStatus.OK);
      await serverRequest
        .post('/mythril/v1/auth/refresh')
        .send({
          accessToken,
          refreshToken,
        }).expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('update user', () => {
    let email;
    let token;
    let otherEmail;
    let otherUser;
    let data;

    beforeEach(async () => {
      email = await registerAndActivateUser();
      token = await loginUser(email);
      otherEmail = await registerAndActivateUser();
      otherUser = await getUserFromDatabase(otherEmail);
      data = {
        firstName: 'testfirstname',
        lastName: 'testlastname',
        termsId: 'no_terms',
        type: ['user']
      };
    });

    it('fail if not admin', async () => {
      await serverRequest
        .put(`/mythril/v1/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(data)
        .expect(httpStatus.FORBIDDEN);
    });

    it('success if admin', async () => {
      await makeUserAdmin(email);
      token = await loginUser(email);
      await serverRequest
        .put(`/mythril/v1/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(data)
        .expect(httpStatus.OK);
    });

    it('fail on invalid terms', async () => {
      await makeUserAdmin(email);
      token = await loginUser(email);
      data.termsId = '123';
      await serverRequest
        .put(`/mythril/v1/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(data)
        .expect(httpStatus.BAD_REQUEST);
    });

    it('fail on invalid type', async () => {
      await makeUserAdmin(email);
      token = await loginUser(email);
      data.type = ['delta'];
      await serverRequest
        .put(`/mythril/v1/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(data)
        .expect(httpStatus.BAD_REQUEST);
    });

    it('delete previous jwts of the user on successful udpate', async () => {
      await loginUser(otherEmail);
      await expect(
        getJwtFromDatabase(null, otherUser._id)
      ).resolves.toBeDefined();
      await makeUserAdmin(email);
      token = await loginUser(email);
      await serverRequest
        .put(`/mythril/v1/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(data)
        .expect(httpStatus.OK);
      await expect(
        getJwtFromDatabase(null, otherUser._id)
      ).resolves.toBeNull();
    });

    it('correctly update database on success', async () => {
      await makeUserAdmin(email);
      token = await loginUser(email);
      await serverRequest
        .put(`/mythril/v1/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(data)
        .expect(httpStatus.OK);
      otherUser = await getUserFromDatabase(otherEmail);
      expect(otherUser.firstName).toBe(data.firstName);
      expect(otherUser.lastName).toBe(data.lastName);
      expect(otherUser.termsId).toBe(data.termsId);
      expect(otherUser.type.length).toBe(data.type.length);
    });
  });

  describe('list users', async () => {
    let email;
    let token;

    beforeEach(async () => {
      email = await registerAndActivateUser();
      await makeUserAdmin(email);
      token = await loginUser(email);
    });

    it('fail if not admin', async () => {
      const otherEmail = await registerAndActivateUser();
      token = await loginUser(otherEmail);
      await serverRequest
        .get('/mythril/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .query({offset: 0, email: ''})
        .expect(httpStatus.FORBIDDEN);
    });

    it('fail if invalid offset', async () => {
      await serverRequest
        .get('/mythril/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .query({offset: -1, email: ''})
        .expect(httpStatus.BAD_REQUEST);
    });

    it('return user data on success', async () => {
      const res = (await serverRequest
        .get('/mythril/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .query({offset: 0, email})
        .expect(httpStatus.OK)).body;
      expect(res.length).toBe(1);
      expect(res.offset).toBe(0);
      expect(res.users[0]).toBeDefined();
      const userData = res.users[0];
      expect(userData).toHaveProperty('id');
      expect(userData).toHaveProperty('email');
      expect(userData).toHaveProperty('firstName');
      expect(userData).toHaveProperty('lastName');
      expect(userData).toHaveProperty('termsId');
      expect(userData).toHaveProperty('type');
    });

    it('correct length on email filter', async () => {
      const newEmail = generateEmailAddress();
      for (let i = 0; i < 100; i++) {
        await serverRequest
          .post('/mythril/v1/users')
          .send({
            firstName: 'David',
            lastName: 'Martin',
            email: i + newEmail,
            termsId: 'no_terms',
          });
      }
      const res = (await serverRequest
        .get('/mythril/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .query({offset: 0, email: newEmail})
        .expect(httpStatus.OK)).body;
      expect(res.length).toBe(100);
      expect(res.offset).toBe(0);
    });
    
    it('correct data on email filter and offset', async () => {
      const newEmail = generateEmailAddress();
      for (let i = 0; i < 87; i++) {
        await serverRequest
          .post('/mythril/v1/users')
          .send({
            firstName: 'David',
            lastName: 'Martin',
            email: i + newEmail,
            termsId: 'no_terms',
          });
      }
      const res = (await serverRequest
        .get('/mythril/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .query({offset: 10, email: newEmail})
        .expect(httpStatus.OK)).body;
      expect(res.length).toBe(87);
      expect(res.offset).toBe(10);
    });
  });
});
