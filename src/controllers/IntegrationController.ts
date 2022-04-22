import { body as bodyCheck } from 'express-validator'

import { validator } from '../helpers/decorators'
import { getIdValidator } from '../helpers/validators'
import Dialpad from '../services/dialpad'
import Ytel from '../services/ytel'
import Integration, { IntegrationPartners } from '../models/Integration.model'

const idValidator = getIdValidator(Integration)

export default class IntegrationController {
  /*
  get the integrations
  */
  static async index(req, res) {
    const rows = await Integration.findAll()

    res.json(rows)
  }

  /*
  create
  */
  @validator([
    bodyCheck('name').exists(),
    bodyCheck('partner').exists(),
    bodyCheck('accountId').optional(),
    bodyCheck('apiKey').exists(),
  ])
  static async create(req, res) {
    const { body } = req
    const integration = await Integration.create(body)

    res.json(integration)
  }

  /*
  show
  */
  @validator([idValidator])
  static async show(req, res) {
    const { integration } = req

    res.json(integration)
  }

  /*
  update
  */
  @validator([idValidator])
  static async update(req, res) {
    const { body, integration } = req

    await integration.update(body)

    res.json(integration)
  }

  /*
  delete
  */
  @validator([idValidator])
  static async delete(req, res) {
    const { integration } = req

    await integration.destroy()
    res.json('success')
  }

  /*
  apiKey
  */
  @validator([
    bodyCheck('partner').isIn(Object.values(IntegrationPartners)),
    bodyCheck('accountId').exists(),
    bodyCheck('apiKey').exists(),
  ])
  static async testApiKey(req, res) {
    const { body } = req
    let api

    if (body.partner === IntegrationPartners.DIALPAD) {
      api = new Dialpad(body.accountId, body.apiKey)
    } else {
      api = new Ytel(body.accountName, body.apiKey)
    }

    try {
      const data = await api.test()

      res.json(data)
    } catch (err) {
      console.log(err)
      res.status(422).json(err)
    }
  }

  @validator([idValidator])
  static async getNumbers(req, res) {
    const { integration } = req

    if (integration.partner === IntegrationPartners.YTEL) {
      res.json([])
      return
    }

    const dialpad = new Dialpad(integration.accountId, integration.apiKey)

    try {
      const numbers = await dialpad.getNumbers()

      res.json(numbers)
    } catch (err) {
      console.log(err)
      res.json([])
    }
  }

  @validator([bodyCheck('agentId').exists(), idValidator])
  static async ytelAgentStatus(req, res) {
    const { integration, body } = req

    const api = new Ytel(integration.accountName, integration.apiKey)

    try {
      const data = await api.getAgentStatus(body.agentId)
      if (data.indexOf('AGENT NOT FOUND') < 0) {
        res.json(true)
      } else {
        res.status(422).json({ agentId: 'invalid' })
      }
    } catch (err) {
      console.log(err)
      res.status(422).json({ agentId: 'invalid' })
    }
  }

  static async getTransferable(req, res) {
    const rows = await Integration.findAll({
      attributes: ['id', 'partner', 'name'],
      where: {
        partner: IntegrationPartners.OPTIMIZE,
      },
    })

    res.json(rows)
  }
}
