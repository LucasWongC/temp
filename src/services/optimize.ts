import axios from 'axios'

class OptimizeService {
  config: any = {}

  constructor(token) {
    this.config = {
      headers: {
        'X-Token': token,
      },
    }
  }

  async ping(values): Promise<any> {
    return axios
      .post(
        '',
        values,
        this.config
      )
      .then(res => res.data)
  }
}

export default OptimizeService
