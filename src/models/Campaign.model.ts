import { Table, Column, DataType, Model, HasMany } from 'sequelize-typescript'
import { Op } from 'sequelize'
import moment from 'moment-timezone'

import config from '../config'
import FollowupProgress, { ProgressStatus } from './FollowupProgress.model'
import FollowUp from './FollowUp.model'

@Table({
  updatedAt: false,
})
class Campaign extends Model<Campaign> {
  @Column({
    allowNull: false,
  })
  name: string

  @Column({
    allowNull: false,
  })
  token: string

  @Column({
    allowNull: false,
    defaultValue: true,
  })
  active: boolean

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  get schedules() {
    const value: any = this.getDataValue('schedules')

    return value ? JSON.parse(value) : []
  }
  set schedules(value) {
    this.setDataValue('schedules', JSON.stringify(value || []))
  }

  getNearestTime(schedule, time) {
    const desiredTime = moment(time)
      .utc()
      .format()
    const days = schedule.days.split(',')
    const firstDayOfWeek = moment()
      .tz(config.TIME_ZONE)
      .startOf('week')

    let nearestTime
    for (const day of days) {
      const date = firstDayOfWeek
        .clone()
        .add(Number(day), 'days')
        .format('YYYY-MM-DD')
      const startTime = moment
        .tz(`${date} ${schedule.from}`, config.TIME_ZONE)
        .utc()
        .format()
      const endTime = moment
        .tz(`${date} ${schedule.to}`, config.TIME_ZONE)
        .utc()
        .format()

      if (desiredTime < startTime) {
        // if the time is before the day, get the start time
        return startTime
      } else if (desiredTime > endTime) {
        // if the day is already past, get the next week day
        if (!nearestTime) {
          const nextWeekDate = `${moment(date)
            .add(7, 'days')
            .format('YYYY-MM-DD')} ${schedule.from}`

          nearestTime = moment
            .tz(nextWeekDate, config.TIME_ZONE)
            .utc()
            .format()
        }
      } else {
        // if the time is in the range
        return desiredTime
      }
    }

    return nearestTime
  }

  getEstimatedTime(exactTime) {
    if (!this.schedules.length) {
      return null
    }

    let estimatedTime

    this.schedules.forEach(schedule => {
      const scheduleTime = this.getNearestTime(schedule, exactTime)
      if (!estimatedTime || estimatedTime > scheduleTime) {
        estimatedTime = scheduleTime
      }
    })

    return estimatedTime
  }

  async updateFollowupProgresses() {
    const progresses = await FollowupProgress.findAll({
      where: {
        progress: { [Op.ne]: ProgressStatus.COMPLETE },
      },
      include: [
        {
          model: FollowUp,
          where: { CampaignId: this.id },
        },
      ],
      order: [['LeadId', 'asc'], ['step', 'asc']],
    })

    let prevLeadId
    let estimatedTime

    for (const progress of progresses) {
      if (!prevLeadId || prevLeadId !== progress.LeadId) {
        prevLeadId = progress.LeadId
        estimatedTime = progress.estimatedTime
      } else {
        estimatedTime = progress.FollowUp.getTime(estimatedTime)
      }

      estimatedTime = this.getEstimatedTime(estimatedTime)

      if (estimatedTime !== progress.estimatedTime) {
        progress.estimatedTime = estimatedTime
        await progress.save()
      }
    }
  }
}

export default Campaign
