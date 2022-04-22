import sequelize, { Op } from 'sequelize'
import moment from 'moment-timezone'

import config from '../config'
import CallLog, { CallResult } from '../models/CallLog.model'
import PhoneNumber from '../models/PhoneNumber.model'
import Lead from '../models/Lead.model'
import TransferNumber from '../models/TransferNumber.model'
import Agent from '../models/Agent.model'

export default class TransferController {
  /*
  get the numbers
  */
  static async index(req, res) {
    const PAGE_SIZE = 30
    const { query } = req
    const page = query.page ? Number(query.page) : 0

    const where: any = {
      CampaignId: query.CampaignId || 0,
      status: CallResult.TRANSFERRED,
    }

    if (query.startDate) {
      where.startTime = {
        [Op.gt]: moment
          .tz(query.startDate, config.TIME_ZONE)
          .startOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss'),
      }
    }

    if (query.endDate) {
      where.startTime = {
        ...(where.startTime || {}),
        [Op.lt]: moment
          .tz(query.endDate, config.TIME_ZONE)
          .endOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss'),
      }
    }

    const rows = await CallLog.findAll({
      attributes: [
        'id',
        'transferStart',
        'transferEnd',
        'transferDuration',
        'CampaignId',
      ],
      where,
      include: [
        {
          attributes: ['id', 'phone', 'firstName', 'lastName'],
          model: Lead,
        },
        {
          attributes: ['number'],
          model: PhoneNumber,
        },
        {
          attributes: ['name', 'phone', 'AgentId'],
          model: TransferNumber,
          include: [
            {
              attributes: ['name', 'phone'],
              model: Agent,
            },
          ],
        },
      ],
      order: [['id', 'DESC']],
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })

    const count = await CallLog.count({
      where,
    })

    res.json({
      page,
      pageSize: PAGE_SIZE,
      pageCount: Math.ceil(count / PAGE_SIZE),
      rows,
    })
  }
  static async charts(req, res) {
    const LAST_DAYS = 30
    const { query } = req

    const where: any = {
      CampaignId: query.CampaignId || 0,
      status: CallResult.TRANSFERRED,
    }

    if (query.startDate) {
      where.startTime = {
        [Op.gt]: moment
          .tz(query.startDate, config.TIME_ZONE)
          .startOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss'),
      }
    }

    if (query.endDate) {
      where.startTime = {
        ...(where.startTime || {}),
        [Op.lt]: moment
          .tz(query.endDate, config.TIME_ZONE)
          .endOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss'),
      }
    }

    const summary = await CallLog.findOne({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalTransfers'],
        [
          sequelize.fn('SUM', sequelize.col('transferDuration')),
          'totalDuration',
        ],
      ],
      where,
    })

    const chartCondition = {
      CampaignId: query.CampaignId || 0,
      status: CallResult.TRANSFERRED,
      startTime: {
        [Op.gt]: moment
          .tz(
            moment()
              .subtract(LAST_DAYS, 'days')
              .format('YYYY-MM-DD'),
            config.TIME_ZONE
          )
          .startOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss'),
        [Op.lt]: moment
          .tz(moment().format('YYYY-MM-DD'), config.TIME_ZONE)
          .endOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss'),
      },
    }

    const charts = await CallLog.findAll({
      attributes: [
        [
          sequelize.literal(
            `DATE(CONVERT_TZ(startTime, '+00:00', '${moment
              .tz(config.TIME_ZONE)
              .format('Z')}'))`
          ),
          'date',
        ],
        [sequelize.literal(`COUNT(id)`), 'totalTransfers'],
        [sequelize.literal(`SUM(transferDuration)`), 'totalDuration'],
      ],
      where: chartCondition,
      group: 'date',
    })

    res.json({
      summary,
      charts,
    })
  }
}
