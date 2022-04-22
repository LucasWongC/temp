import fs from 'fs'
import csv from 'csvtojson'
import ZipCode from '../models/ZipCode.model'

export default class ImportController {
  static async importZipCode() {
    const fields = {
      Zipcode: 'zipCode',
      City: 'city',
      State: 'state',
      Location: 'location',
      Lat: 'lat',
      Long: 'long',
    }

    const startRow = 0
    const chunkSize = 100
    let chunk = []

    console.log(`----- Importing zip codes ------`)

    fs.createReadStream('free-zipcode-database-Primary.csv').pipe(
      csv({
        delimiter: ',',
      })
        .subscribe(async (jsonObj, lineIdx) => {
          if (lineIdx < startRow) {
            return
          }

          const data = {}
          Object.keys(fields).forEach(name => {
            if (!jsonObj[name]) {
              return
            }

            data[fields[name]] = jsonObj[name]
          })

          chunk.push(data)
          if (chunk.length >= chunkSize) {
            try {
              await ZipCode.bulkCreate(chunk)
            } catch (e) {
              console.log(jsonObj)
              throw e
            }
            chunk = []
            console.log(`Inserted to ${lineIdx}`)
          }
        })
        .on('done', async () => {
          // wait a few minute
          setTimeout(async () => {
            if (chunk.length) {
              await ZipCode.bulkCreate(chunk)
              chunk = []
            }
            console.log(`----- Completed ------`)
          }, 3000)
        })
    )
  }
}
