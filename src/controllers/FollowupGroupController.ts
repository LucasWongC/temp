import { body as bodyCheck } from 'express-validator'
import sequelize from 'sequelize'

import { validator } from '../helpers/decorators'
import { getIdValidator } from '../helpers/validators'
import FollowupGroup, { FollowupGroupType } from '../models/FollowupGroup.model'
import { ProgressStatus } from '../models/FollowupProgress.model'
import { CallResult } from '../models/CallLog.model'
import Campaign from '../models/Campaign.model'

const idValidator = getIdValidator(FollowupGroup)

export default class FollowupGroupController {
  /*
  get the followupGroups
  */
  static async index(req, res) {
    const { query } = req
    const replacements = {
      CampaignId: query.CampaignId || 0,
    }

    let sql

    if (query.statistics) {
      sql = `
        SELECT FollowupGroups.*, CallLogs.*, totalLeads, activeLeads
        FROM FollowupGroups
        LEFT JOIN (
          SELECT
            FollowUps.FollowupGroupId,
            COUNT(DISTINCT(LeadId)) AS totalLeads,
            SUM(IF(FollowupProgresses.progress = '${ProgressStatus.NEXT}' AND FollowupProgresses.LeadInteractionId = Leads.currentInteraction, 1, 0)) AS activeLeads
          FROM FollowupProgresses
          LEFT JOIN FollowUps ON FollowUps.id = FollowupProgresses.FollowUpId
          LEFT JOIN Leads ON Leads.id = FollowupProgresses.LeadId
          GROUP BY FollowUps.FollowupGroupId
        ) FollowupProgresses ON FollowupProgresses.FollowupGroupId = FollowupGroups.id
        LEFT JOIN (
          SELECT
            FollowUps.FollowupGroupId,
            SUM(IF(status <> '${CallResult.NOT_ANSWERED}', 1, 0)) AS answers,
            SUM(IF(status = '${CallResult.ANSWERED}', 1, 0)) AS answered,
            SUM(IF(status = '${CallResult.TRANSFERRED}', 1, 0)) AS transferred,
            SUM(IF(status = '${CallResult.REMOVED}', 1, 0)) AS removed
          FROM CallLogs
          LEFT JOIN FollowUps ON FollowUps.id = CallLogs.FollowUpId
          GROUP BY FollowUps.FollowupGroupId
        ) CallLogs ON CallLogs.FollowupGroupId = FollowupGroups.id
        WHERE CampaignId = :CampaignId
        ORDER BY id
      `
    } else {
      sql = `
        SELECT FollowupGroups.*
        FROM FollowupGroups
        WHERE CampaignId = :CampaignId
        ORDER BY id
      `
    }

    const rows = await FollowupGroup.sequelize.query(sql, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    })

    res.json(rows)
  }

  /*
  create the followupGroup
  */
  @validator([
    bodyCheck('name').exists(),
    getIdValidator(Campaign, 'CampaignId'),
  ])
  static async create(req, res) {
    const { body } = req

    const followupGroup = await FollowupGroup.create(body)
    res.json(followupGroup)
  }

  /*
  get the followupGroup
  */
  @validator([idValidator])
  static async show(req, res) {
    res.json(req.followupGroup)
  }

  /*
  update the followupGroup
  */
  @validator([idValidator])
  static async update(req, res) {
    const { followupGroup, body } = req
    const acceptFields = ['name', 'type', 'knownOnly']
    for (const field of acceptFields) {
      if (body[field] !== undefined) {
        followupGroup[field] = body[field]
      }
    }

    await followupGroup.save()

    res.json(followupGroup)
  }

  /*
  delete the campaign
  */
  @validator([idValidator])
  static async delete(req, res) {
    const { followupGroup } = req

    await followupGroup.destroy()
    res.json('success')
  }

  static async getSchedules(req, res) {
    const { query } = req

    const rows = await FollowupGroup.findAll({
      attributes: ['id', 'name'],
      where: {
        type: FollowupGroupType.SCHEDULE,
        CampaignId: query.CampaignId || 0,
      },
    })

    res.json(rows)
  }
}
