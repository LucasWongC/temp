import { body as bodyCheck } from 'express-validator'
import moment from 'moment-timezone'
import sequelize from 'sequelize'

import config from '../config'
import { validator } from '../helpers/decorators'
import { getIdValidator } from '../helpers/validators'
import PhoneNumber from '../models/PhoneNumber.model'
import { CallResult } from '../models/CallLog.model'
import Campaign from '../models/Campaign.model'

const idValidator = getIdValidator(PhoneNumber)

export default class NumberController {
  /*
  get the numbers
  */
  static async index(req, res) {
    const { query } = req
    const replacements = {
      CampaignId: query.CampaignId || 0,
    }

    const callConditions = ['1']

    if (query.startDate) {
      callConditions.push(
        `CallLogs.startTime >= '${moment
          .tz(query.startDate, config.TIME_ZONE)
          .startOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss')}'`
      )
    }

    if (query.endDate) {
      callConditions.push(
        `CallLogs.startTime <= '${moment
          .tz(query.endDate, config.TIME_ZONE)
          .endOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss')}'`
      )
    }

    const sql = `
      SELECT PhoneNumbers.*, CallLogs.calls, CallLogs.answers, CallLogs.answered, CallLogs.transferred, CallLogs.removed
      FROM PhoneNumbers
      LEFT JOIN (
        SELECT
          PhoneNumberId,
          COUNT(id) AS calls,
          SUM(IF(status <> '${CallResult.NOT_ANSWERED}', 1, 0)) AS answers,
          SUM(IF(status = '${CallResult.ANSWERED}', 1, 0)) AS answered,
          SUM(IF(status = '${CallResult.TRANSFERRED}', 1, 0)) AS transferred,
          SUM(IF(status = '${CallResult.REMOVED}', 1, 0)) AS removed
        FROM CallLogs
        WHERE ${callConditions.join(' AND ')}
        GROUP BY PhoneNumberId
      ) CallLogs ON CallLogs.PhoneNumberId = PhoneNumbers.id
      WHERE CampaignId = :CampaignId
    `

    const rows = await PhoneNumber.sequelize.query(sql, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    })

    res.json(rows)
  }

  /*
  create the number
  */
  @validator([
    bodyCheck('source')
      .exists()
      .isIn(['Twilio']),
    bodyCheck('number').exists(),
    getIdValidator(Campaign, 'CampaignId'),
  ])
  static async create(req, res) {
    const { body } = req

    // check duplication
    const isExisting = await PhoneNumber.findOne({
      where: {
        number: body.number,
      },
    })

    if (isExisting) {
      res.status(503).json({ errors: 'The number exists' })
    } else {
      const number = await PhoneNumber.create(body)
      res.json(number)
    }
  }

  /*
  get the number
  */
  @validator([idValidator])
  static async show(req, res) {
    res.json(req.phoneNumber)
  }

  /*
  update the number
  */
  @validator([idValidator, bodyCheck('active').exists()])
  static async update(req, res) {
    const { phoneNumber, body } = req

    await phoneNumber.update({
      active: body.active,
    })

    res.json(phoneNumber)
  }

  /*
  delete the campaign
  */
  @validator([idValidator])
  static async delete(req, res) {
    const { phoneNumber } = req

    await phoneNumber.destroy()
    res.json('success')
  }
}
