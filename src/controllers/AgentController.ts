import { body as bodyCheck } from 'express-validator'

import { validator } from '../helpers/decorators'
import { getIdValidator } from '../helpers/validators'
import Agent from '../models/Agent.model'
import Integration, { IntegrationPartners } from '../models/Integration.model'

const idValidator = getIdValidator(Agent)

export default class AgentController {
  /*
  get the numbers
  */
  static async index(req, res) {
    const rows = await Agent.findAll({
      include: [Integration],
    })

    res.json(rows)
  }

  /*
  create the number
  */
  @validator([
    bodyCheck('name').exists(),
    bodyCheck('states')
      .optional()
      .isArray(),
    bodyCheck('phone').exists(),
    bodyCheck('agentId').optional(),
    getIdValidator(Integration, 'IntegrationId'),
  ])
  static async create(req, res) {
    const { body, integration } = req

    if (integration.partner === IntegrationPartners.YTEL && !body.agentId) {
      res.status(422).json({ agentId: 'Agent ID is required' })
      return
    }

    const agent = await Agent.create(body)

    res.json({
      ...agent.toJSON(),
      Integration: integration,
    })
  }

  /*
  get the number
  */
  @validator([idValidator])
  static async show(req, res) {
    res.json(req.agent)
  }

  /*
  update the number
  */
  @validator([
    idValidator,
    bodyCheck('states')
      .optional()
      .isArray(),
  ])
  static async update(req, res) {
    const { agent, body } = req

    await agent.update(body)

    const integration = await agent.getIntegration()

    res.json({
      ...agent.toJSON(),
      Integration: integration,
    })
  }

  /*
  delete the campaign
  */
  @validator([idValidator])
  static async delete(req, res) {
    const { agent } = req

    await agent.destroy()
    res.json('success')
  }
}
