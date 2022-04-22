import axios from 'axios';
import qs from 'qs';
import csv from 'csvtojson';

class Ytel {
  config = null;
  constructor(account, pass) {
    this.config = {
      account,
      pass,
    };
  }

  callFunc(func, params) {
    return axios
      .get(
        `http://${
          this.config.account
        }.ytel.com/x5/api/non_agent.php?source=test&${qs.stringify({
          user: 101,
          pass: this.config.pass,
          function: func,
          ...params,
        })}`,
        {
          headers: {
            'Content-Type': 'application/text',
          },
        }
      )
      .then(res => res.data);
  }

  test() {
    return this.callFunc('vm_list', {
      format: 'selectframe',
      comments: 'fieldname',
      stage: 'date',
    });
  }

  getAgentStatus(agentId) {
    return this.callFunc('agent_status', {
      agent_user: agentId,
      stage: 'csv',
      header: 'YES',
    });
  }

  async checkAgentStatus(agentId) {
    const res = await this.getAgentStatus(agentId);

    if (res.indexOf('ERROR') >= 0) return false;

    const rows = await csv().fromString(res);

    return rows.length && (rows[0].status == 'CLOSER' || rows[0].status == 'READY');
  }

  async addLead(data) {
    return this.callFunc('add_lead', {
      ...data,
      phone_code: 1,
      source: 'MC',
      callSource: 'Caller',
    });
  }
}

export default Ytel;
