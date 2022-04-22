import CallLog from '../models/CallLog.model'
import Lead from '../models/Lead.model'
import IVR from '../models/IVR.model'
import PhoneNumber from '../models/PhoneNumber.model'
import FollowupProgress from '../models/FollowupProgress.model'

export default class CallLogController {
  /*
  get the call logs
  */
  static async index(req, res) {
    const PAGE_SIZE = 30
    const page = req.query.page ? Number(req.query.page) : 0

    const { count, rows } = await CallLog.findAndCountAll({
      where: {
        CampaignId: req.query.CampaignId || 0,
      },
      include: [Lead, IVR, PhoneNumber, FollowupProgress],
      order: [['startTime', 'DESC']],
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    })

    res.json({
      page,
      pageSize: PAGE_SIZE,
      pageCount: Math.ceil(count / PAGE_SIZE),
      rows,
    })
  }
}
