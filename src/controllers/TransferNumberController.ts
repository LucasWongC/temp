import { body as bodyCheck } from 'express-validator'
import sequelize, { Op } from 'sequelize'
import moment from 'moment-timezone'

import config from '../config'
import { validator } from '../helpers/decorators'
import { getIdValidator } from '../helpers/validators'
import TransferNumber from '../models/TransferNumber.model'
import Agent from '../models/Agent.model'
import CallLog from '../models/CallLog.model'
import TransferOption from '../models/TransferOption.model'

const idValidator = getIdValidator(TransferNumber)

export default class TransferNumberController {
  /*
  get the numbers
  */
  static async index(req, res) {
    const { query } = req
    const conditions: any = {}
    if (query.startDate) {
      conditions.startTime = {
        [Op.gte]: `${moment
          .tz(moment(query.startDate).format('YYYY-MM-DD'), config.TIME_ZONE)
          .startOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss')}`,
      }
    }

    if (query.endDate) {
      conditions.startTime = {
        ...(conditions.startTime || {}),
        [Op.lte]: `${moment
          .tz(moment(query.endDate).format('YYYY-MM-DD'), config.TIME_ZONE)
          .endOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss')}`,
      }
    }

    const numbers = await TransferNumber.findAll({
      attributes: {
        include: [
          [
            sequelize.fn('COUNT', sequelize.col('CallLogs.id')),
            'transferCount',
          ],
        ],
      },
      where: {
        TransferOptionId: query.TransferOptionId,
      },
      include: [
        {
          model: Agent,
          attributes: ['name', 'phone'],
        },
        {
          model: CallLog,
          attributes: [],
          where: conditions,
          required: false,
        },
      ],
      group: 'id',
      order: [['createdAt', 'asc']],
    })

    res.json(numbers)
  }

  /*
  create the number
  */
  @validator([
    bodyCheck('name').optional(),
    bodyCheck('source').exists(),
    bodyCheck('phone').optional(),
    getIdValidator(TransferOption, 'TransferOptionId'),
  ])
  static async create(req, res) {
    const { body } = req

    const transferNumber = await TransferNumber.create(body)

    let agent = null
    if (transferNumber.AgentId) {
      agent = await transferNumber.$get('Agent')
    }
    res.json({
      ...transferNumber.toJSON(),
      Agent: agent,
    })
  }

  /*
  get the number
  */
  @validator([idValidator])
  static async show(req, res) {
    res.json(req.transferNumber)
  }

  /*
  update the number
  */
  @validator([idValidator])
  static async update(req, res) {
    const { transferNumber, body } = req

    await transferNumber.update(body)

    let agent = null
    if (transferNumber.AgentId) {
      agent = await transferNumber.getAgent()
    }
    res.json({
      ...transferNumber.toJSON(),
      Agent: agent,
    })
  }

  /*
  delete the campaign
  */
  @validator([idValidator])
  static async delete(req, res) {
    const { transferNumber } = req

    await transferNumber.destroy()
    res.json('success')
  }

  static async updateOrder(req, res) {
    const { body } = req

    for (const bodyItem of body) {
      await TransferNumber.update(
        { order: bodyItem.order },
        {
          where: { id: bodyItem.id },
        }
      )
    }

    res.json('success')
  }
}
