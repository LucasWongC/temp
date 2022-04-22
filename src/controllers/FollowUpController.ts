import { body as bodyCheck } from 'express-validator'
import sequelize from 'sequelize'

import { validator } from '../helpers/decorators'
import { getIdValidator } from '../helpers/validators'
import FollowUp, { FollowupType } from '../models/FollowUp.model'
import FollowupGroup from '../models/FollowupGroup.model'
import { CallResult } from '../models/CallLog.model'

const idValidator = getIdValidator(FollowUp)

export default class FollowUpController {
  /*
  get the followUps
  */
  static async index(req, res) {
    const replacements = req.query

    const sql = `
      SELECT FollowUps.*, CallLogs.timesUsed, CallLogs.answered, CallLogs.transferred, CallLogs.removed
      FROM FollowUps
      LEFT JOIN (
        SELECT
          FollowUpId,
          COUNT(id) AS timesUsed,
          SUM(IF(status = '${CallResult.ANSWERED}', 1, 0)) AS answered,
          SUM(IF(status = '${CallResult.TRANSFERRED}', 1, 0)) AS transferred,
          SUM(IF(status = '${CallResult.REMOVED}', 1, 0)) AS removed
        FROM CallLogs
        GROUP BY FollowUpId
      ) CallLogs ON CallLogs.FollowUpId = FollowUps.id
      WHERE FollowupGroupId = :FollowupGroupId
      ORDER BY incoming DESC, \`order\` ASC
    `

    const rows = await FollowUp.sequelize.query(sql, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    })

    res.json(rows)
  }

  /*
  create the followUp
  */
  @validator([
    bodyCheck('type')
      .exists()
      .isIn(Object.values(FollowupType)),
    bodyCheck('hours')
      .exists()
      .isNumeric(),
    bodyCheck('minutes')
      .exists()
      .isNumeric(),
    bodyCheck('seconds')
      .exists()
      .isNumeric(),
    bodyCheck('leaveVoiceMail').isBoolean(),
    bodyCheck('mailText').custom((mailText, { req }) => {
      if (req.body.leaveVoiceMail && !mailText) {
        throw new Error('Required')
      }

      return true
    }),
    bodyCheck('incoming').isBoolean(),
    getIdValidator(FollowupGroup, 'FollowupGroupId'),
  ])
  static async create(req, res) {
    const { body, followupGroup } = req

    // validate duplicate schedule
    if (body.type === FollowupType.SCHEDULE) {
      const isDuplicate = await FollowUp.count({
        where: {
          type: FollowupType.SCHEDULE,
          FollowupGroupId: followupGroup.id,
        },
      })
      if (isDuplicate) {
        return res.status(422).json({ error: 'Schedule is added already' })
      }
    }

    const followUp = await FollowUp.create({
      ...body,
      order: body.incoming ? 0 : 100,
      CampaignId: followupGroup.CampaignId,
    })
    res.json(followUp)
  }

  /*
  get the followUp
  */
  @validator([idValidator])
  static async show(req, res) {
    res.json(req.followUp)
  }

  /*
  update the followUp
  */
  @validator([
    idValidator,
    bodyCheck('type')
      .optional()
      .isIn(Object.values(FollowupType)),
    bodyCheck('hours')
      .optional()
      .isNumeric(),
    bodyCheck('minutes')
      .optional()
      .isNumeric(),
    bodyCheck('seconds')
      .optional()
      .isNumeric(),
  ])
  static async update(req, res) {
    const { followUp, body } = req

    await followUp.update(body)

    res.json(followUp)
  }

  /*
  delete the campaign
  */
  @validator([idValidator])
  static async delete(req, res) {
    const { followUp } = req

    await followUp.destroy()
    res.json('success')
  }

  static async updateOrder(req, res) {
    const { body } = req

    for (const item of body) {
      await FollowUp.update(
        {
          order: item.order,
        },
        {
          where: { id: item.id },
        }
      )
    }

    res.json({ success: true })
  }
}
