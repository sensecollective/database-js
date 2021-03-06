const AbstractClient = require('./AbstractClient')
const { Term } = require('./terms')

// If fetch is not declared, load it from the node-fetch module.
// (This makes it possible to run RemoteClient in the browser and in node-js.)
const fetch = (() => {
  try {
    return fetch
  } catch (e) {
    return require('node-fetch')
  }
})()

export default class RemoteClient extends AbstractClient {
  constructor (address, port, id) {
    super(id)
    this._address = address
    this._port = port
  }

  select (...patternStrings) {
    const patterns = patternStrings.map(
      p =>
        p instanceof Array
          ? this._toJSONFactOrPattern(...p)
          : this._toJSONFactOrPattern(p)
    )
    const solutions = async () => {
      const params = `query=${JSON.stringify(patterns)}`
      const response = await fetch(
        `http://${this._address}:${this._port}/facts?${params}`
      )
      return await response.json()
    }
    const results = {
      async do (callbackFn) {
        for (let solution of await solutions()) {
          for (let name in solution) {
            // force serialization and deserialization to simulate going over the network
            const json = JSON.parse(JSON.stringify(solution[name]))
            solution[name] = Term.fromJSON(json).toRawValue()
          }
          await callbackFn(solution)
        }
        return results
      },
      async count () {
        return (await solutions()).length
      },
      async isEmpty () {
        return (await solutions()).length === 0
      },
      async isNotEmpty () {
        return (await solutions()).length > 0
      }
    }
    return results
  }

  async flushChanges () {
    const retractions = this._retracts
    const assertions = this._asserts
    this._retracts = []
    this._asserts = []
    const params =
      'clientId=' +
      this._id +
      '&' +
      'retractions=' +
      JSON.stringify(retractions) +
      '&' +
      'assertions=' +
      JSON.stringify(assertions)
    const response = await fetch(
      `http://${this._address}:${this._port}/facts?${params}`,
      { method: 'PUT' }
    )
    return await response.json()
  }

  async immediatelyRetractEverythingAbout (name) {
    const response = await fetch(
      `http://${this._address}:${this._port}/facts?clientId=${
        this._id
      }&name=${name}`,
      { method: 'DELETE' }
    )
    return await response.json()
  }

  async immediatelyRetractEverythingAssertedByMe () {
    const response = await fetch(
      `http://${this._address}:${this._port}/facts?clientId=${this._id}`,
      { method: 'DELETE' }
    )
    return await response.json()
  }

  async getAllFacts () {
    const response = await fetch(`http://${this._address}:${this._port}/facts`)
    return await response.json()
  }

  toString () {
    return `[RemoteClient ${this._address}:${this._port}, ${this._id}]`
  }
}

module.exports = RemoteClient
