import axios from 'axios';

const API_URL = 'https://dialpad.com/api/v2';

class Dialpad {
  config = null;
  officeId = null;
  apiKey = null;

  constructor(officeId, apiKey) {
    this.officeId = officeId;
    this.apiKey = apiKey;
    this.config = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    };
  }

  get(url) {
    return axios.get(API_URL + url, this.config).then(res => res.data);
  }

  test() {
    return this.get(`/offices/${this.officeId}`);
  }

  getCompany() {
    return this.get('/company');
  }

  getNumbers() {
    const officeId = this.officeId;

    return this.get(`/numbers`).then(res =>
      res.items
        .filter(item => item.office_id === officeId)
        .map(item => ({
          number: item.number,
        }))
    );
  }

  getOfficeById() {
    return this.get(`/offices/${this.officeId}`);
  }

  getDepartmentById(id) {
    return this.get(`/departments/${id}`);
  }

  getCallCenterById(id) {
    return this.get(`/callcenters/${id}`);
  }

  getUserById(id) {
    return this.get(`/users/${id}`);
  }

  getNumberDetail(number) {
    return this.get(`/numbers/${number}`);
  }

  async getNumberStatus(number) {
    const detail = await this.getNumberDetail(number);
    let res = {};

    if (detail.status === 'available') {
      res = { state: 'active' };
    } else if (detail.status === 'office') {
      res = await this.getOfficeById(detail.target_id);
    } else if (detail.status === 'department') {
      res = await this.getDepartmentById(detail.target_id);
    } else if (detail.target_type === 'callcenter') {
      res = await this.getCallCenterById(detail.target_id);
    } else if (detail.target_type === 'user') {
      res = await this.getUserById(detail.target_id);
    }

    return res.state === 'active';
  }
}

export default Dialpad;
