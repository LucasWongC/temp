import { body as bodyCheck } from 'express-validator'
import randtoken from 'rand-token'
import moment from 'moment-timezone'
import sequelize from 'sequelize'

import config from '../config'
import { validator } from '../helpers/decorators'
import { getIdValidator } from '../helpers/validators'
import Campaign from '../models/Campaign.model'
import { CallResult } from '../models/CallLog.model'

const idValidator = getIdValidator(Campaign)

export default class CampaignController {
  /*
  get the campaigns
  */
  static async index(req, res) {
    const { query } = req

    const conditions = ['Leads.blocked = 0']

    if (query.startDate) {
      conditions.push(
        `Leads.createdAt >= '${moment
          .tz(query.startDate, config.TIME_ZONE)
          .startOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss')}'`
      )
    }

    if (query.endDate) {
      conditions.push(
        `Leads.createdAt <= '${moment
          .tz(query.endDate, config.TIME_ZONE)
          .endOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss')}'`
      )
    }

    const sql = `
      SELECT
        Campaigns.id, Campaigns.name, Campaigns.active, Campaigns.createdAt,
        COUNT(DISTINCT Leads.id) AS totalLeads,
        COUNT(CallLogs.id) AS dialed,
        SUM(IF(CallLogs.status <> '${
          CallResult.NOT_ANSWERED
        }', 1, 0)) AS contacted,
        SUM(IF(CallLogs.status = '${
          CallResult.TRANSFERRED
        }', 1, 0)) AS transferred
      FROM Campaigns
      LEFT JOIN Leads ON Leads.CampaignId = Campaigns.id AND ${conditions.join(
        ' AND '
      )}
      LEFT JOIN CallLogs ON CallLogs.LeadId = Leads.id
      GROUP BY Campaigns.id
    `

    const campaigns = await Campaign.sequelize.query(sql, {
      type: sequelize.QueryTypes.SELECT,
    })

    res.json(campaigns)
  }

  /*
  create the campaign
  */
  @validator([bodyCheck('name').exists(), bodyCheck('schedules').exists()])
  static async create(req, res) {
    const { body } = req
    const campaign = await Campaign.create({
      name: body.name,
      schedules: body.schedules,
      token: randtoken.generate(30),
    })

    res.json(campaign)
  }

  /*
  get the campaign detail
  */
  @validator([idValidator])
  static async show(req, res) {
    const { campaign } = req

    const sql = `
      SELECT SUM(unreadCount) AS unreadCount
      FROM SMSContacts
      JOIN Leads ON Leads.id = SMSContacts.LeadId
      WHERE Leads.CampaignId = :CampaignId
    `
    const [countRow] = await Campaign.sequelize.query(sql, {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        CampaignId: campaign.id,
      },
    })

    res.json({
      ...campaign.toJSON(),
      messageCount: countRow.unreadCount,
    })
  }

  @validator([idValidator])
  static async getMessageCount(req, res) {
    const { campaign } = req

    const sql = `
      SELECT SUM(unreadCount) AS unreadCount
      FROM SMSContacts
      JOIN Leads ON Leads.id = SMSContacts.LeadId
      WHERE Leads.CampaignId = :CampaignId
    `
    const [countRow] = await Campaign.sequelize.query(sql, {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        CampaignId: campaign.id,
      },
    })

    res.json(countRow.unreadCount)
  }

  /*
  update the campaign
  */
  @validator([idValidator])
  static async update(req, res) {
    const { body, campaign } = req

    await campaign.update(body)

    res.json(campaign)
  }

  /*
  delete the campaign
  */
  @validator([idValidator])
  static async delete(req, res) {
    const { campaign } = req

    await campaign.destroy()
    res.json('success')
  }
}
