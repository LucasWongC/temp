import { Table, Column, DataType, Model } from 'sequelize-typescript'

@Table({
  timestamps: false,
  indexes: [
    {
      unique: false,
      fields: ['zipCode'],
    },
  ],
})
class ZipCode extends Model<ZipCode> {
  @Column({
    type: DataType.STRING(5),
    allowNull: false,
  })
  zipCode: string

  @Column
  city: string

  @Column
  state: string

  @Column
  location: string

  @Column
  lat: string

  @Column
  long: string

  static findByCode(zipCode) {
    return ZipCode.findOne({
      where: { zipCode },
    })
  }
}

export default ZipCode
