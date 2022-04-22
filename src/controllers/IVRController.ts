import { body as bodyCheck } from 'express-validator'
import sequelize from 'sequelize'

import { validator } from '../helpers/decorators'
import { getIdValidator } from '../helpers/validators'
import IVR from '../models/IVR.model'
import Campaign from '../models/Campaign.model'

const idValidator = getIdValidator(IVR)

export default class IVRController {
  /*
  get the IVRs
  */
  static async index(req, res) {
    const replacements = {
      CampaignId: req.query.CampaignId || 0,
    }

    const sql = `
      SELECT IVRs.*, CallLogs.timesUsed, CallLogs.transferred
      FROM IVRs
      LEFT JOIN (
        SELECT
          IVRId,
          COUNT(id) AS timesUsed,
          SUM(IF(status = 'Transferred', 1, 0)) AS transferred
        FROM CallLogs
        GROUP BY IVRId
      ) CallLogs ON CallLogs.IVRId = IVRs.id
      WHERE CampaignId = :CampaignId
    `

    const rows = await IVR.sequelize.query(sql, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    })

    res.json(rows)
  }

  /*
  create the IVR
  */
  @validator([
    bodyCheck('name').exists(),
    bodyCheck('voice').exists(),
    bodyCheck('speed')
      .exists()
      .isNumeric(),
    bodyCheck('pauseTime')
      .exists()
      .isNumeric(),
    bodyCheck('loopTime')
      .exists()
      .isNumeric(),
    bodyCheck('loop')
      .exists()
      .isNumeric(),
    getIdValidator(Campaign, 'CampaignId'),
  ])
  static async create(req, res) {
    const { body } = req

    const ivr = await IVR.create(body)
    res.json(ivr)
  }

  /*
  get the IVR
  */
  @validator([idValidator])
  static async show(req, res) {
    res.json(req.iVR)
  }

  /*
  update the IVR
  */
  @validator([
    idValidator,
    bodyCheck('speed')
      .optional()
      .isNumeric(),
    bodyCheck('pauseTime')
      .optional()
      .isNumeric(),
    bodyCheck('loopTime')
      .optional()
      .isNumeric(),
    bodyCheck('loop')
      .optional()
      .isNumeric(),
  ])
  static async update(req, res) {
    const { iVR, body } = req

    await iVR.update({
      ...body,
      CampaignId: undefined,
    })

    res.json(iVR)
  }

  /*
  delete the campaign
  */
  @validator([idValidator])
  static async delete(req, res) {
    const { iVR } = req

    await iVR.destroy()
    res.json('success')
  }
}
