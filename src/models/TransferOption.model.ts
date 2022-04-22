import {
  Table,
  Column,
  Model,
  BelongsTo,
  ForeignKey,
} from 'sequelize-typescript'

import Dialpad from '../services/dialpad'
import Ytel from '../services/ytel'
import Agent from './Agent.model'
import Campaign from './Campaign.model'
import Lead from './Lead.model'
import Integration, { IntegrationPartners } from './Integration.model'
import TransferNumber from './TransferNumber.model'

@Table({
  updatedAt: false,
})
class TransferOption extends Model<TransferOption> {
  @Column({
    allowNull: false,
  })
  name: string

  @BelongsTo(() => Campaign, {
    onDelete: 'CASCADE',
  })
  Campaign: Campaign

  @ForeignKey(() => Campaign)
  @Column
  CampaignId: number

  static async getAvailableNumber(optionId, lead: Lead) {
    const numbers = await TransferNumber.findAll({
      where: {
        TransferOptionId: optionId,
        active: 1,
      },
      include: [
        {
          model: Agent,
          include: [Integration],
        },
        Integration,
      ],
    })

    const internalNumbers = numbers.filter(number => !!number.Agent)
    const checkPromises = []

    internalNumbers.forEach(internalNumber => {
      const agent = internalNumber.Agent

      // skip if state does not match
      if (
        (lead.state &&
          agent.states.length &&
          agent.states.indexOf(lead.state) === -1) ||
        (lead.age && (lead.age < agent.startAge || lead.age > agent.endAge))
      ) {
        checkPromises.push(Promise.resolve(false))
        return
      }

      if (agent.Integration.partner === IntegrationPartners.DIALPAD) {
        const dialpad = new Dialpad(
          agent.Integration.accountId,
          agent.Integration.apiKey
        )
        checkPromises.push(dialpad.getNumberStatus(agent.phone))
      } else {
        const ytel = new Ytel(
          agent.Integration.accountName,
          agent.Integration.apiKey
        )
        checkPromises.push(ytel.checkAgentStatus(agent.agentId))
      }
    })

    if (checkPromises.length) {
      const results = await Promise.all(checkPromises)
      for (let i = 0; i < results.length; i += 1) {
        if (!results[i]) {
          continue
        }

        // post lead data to ytel before transferring
        const transferNumber = internalNumbers[i]

        if (
          transferNumber.Agent &&
          transferNumber.Agent.Integration.partner === IntegrationPartners.YTEL
        ) {
          const ytel = new Ytel(
            transferNumber.Agent.Integration.accountName,
            transferNumber.Agent.Integration.apiKey
          )

          await ytel.addLead({
            first_name: lead.firstName,
            last_name: lead.lastName,
            city: lead.city,
            state: lead.state,
            zip_code: lead.zipCode,
            phone_number: lead.phone,
            age: lead.age,
            list_id: transferNumber.Agent.Integration.accountId,
          })
        }

        return transferNumber
      }
    }

    const manual = numbers.find(number => number.source === 'Manual')

    return manual || null
  }
}

export default TransferOption
