/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-console */
import { loadStdlib } from '@reach-sh/stdlib'
import assert from 'assert'
import * as backend from './build/index.main.mjs'

// Load Reach stdlib
const stdlib = loadStdlib()
if (stdlib.connector !== 'ALGO') {
    throw Error('stdlib.connector must be ALGO')
}

// Define utility functions
export class Signal {
    constructor() {
        const me = this
        this.p = new Promise((resolve) => { me.r = resolve })
    }
    wait() { return this.p }
    notify() { this.r(true) }
}

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms))
const thread = async (f) => await f()

const algo = (x) => stdlib.formatCurrency(x, 4)
const fmt = (x) => `${algo(x)} ALGO`

const callAPI = async (name, f, successMsg, failureMsg) => {
    console.log(`${name} is calling the API`)
    await timeout(10 * Math.random())
    let result
    try {
        result = await f()
        console.log(successMsg)
    }
    catch (e) {
        console.log(failureMsg)
    }
    return result
}

const setup = async () => {
    const startingBalance = stdlib.parseCurrency(100)

    // Create test accounts
    const accAdmin = await stdlib.newTestAccount(startingBalance)

    return accAdmin
}

const getAndLogBalance = async (account, name) => {
    const balance = await stdlib.balanceOf(account)
    console.log(`${name} has ${fmt(balance)}`)
    return algo(balance)
}

const userConnectAndStop = async (name, account, contract, ready) => {
    return async () => {
        console.log(`${name} is attaching to the contract...`)
        const ctc = account.contract(backend, contract.getInfo())
        const spp = ctc.a.SolarPowerPlant

        console.log(`${name} has ${fmt(await stdlib.balanceOf(account))}`)

        await ready.wait()

        // Initial state

        let sppDetails = await callAPI(
            name,
            () => spp.get(),
            `${name} managed to get the spp`,
            `${name} failed to get the spp`
        )

        console.log(`${name} sees that spp has `, {
            capacity: sppDetails[0].toNumber(),
            output: sppDetails[1].toNumber()
        })

        assert(sppDetails[0].toNumber() == 0)
        assert(sppDetails[1].toNumber() == 0)

        console.log(`${name} has ${fmt(await stdlib.balanceOf(account))}`)

        // Set capacity

        await callAPI(
            name,
            () => spp.setCapacity(10),
            `${name} managed to set the spp capacity`,
            `${name} failed to set the spp capacity`
        )

        sppDetails = await callAPI(
            name,
            () => spp.get(),
            `${name} managed to get the spp`,
            `${name} failed to get the spp`
        )

        console.log(`${name} sees that spp has `, {
            capacity: sppDetails[0].toNumber(),
            output: sppDetails[1].toNumber()
        })

        assert(sppDetails[0].toNumber() == 10)
        assert(sppDetails[1].toNumber() == 0)

        console.log(`${name} has ${fmt(await stdlib.balanceOf(account))}`)

        // Increase capacity

        await callAPI(
            name,
            () => spp.increaseCapacity(25),
            `${name} managed to increase the spp capacity`,
            `${name} failed to increase the spp capacity`
        )

        sppDetails = await callAPI(
            name,
            () => spp.get(),
            `${name} managed to get the spp`,
            `${name} failed to get the spp`
        )

        console.log(`${name} sees that spp has `, {
            capacity: sppDetails[0].toNumber(),
            output: sppDetails[1].toNumber()
        })

        assert(sppDetails[0].toNumber() == 35)
        assert(sppDetails[1].toNumber() == 0)

        console.log(`${name} has ${fmt(await stdlib.balanceOf(account))}`)

        // Set output

        await callAPI(
            name,
            () => spp.setOutput(15),
            `${name} managed to set the spp output`,
            `${name} failed to set the spp output`
        )

        sppDetails = await callAPI(
            name,
            () => spp.get(),
            `${name} managed to get the spp`,
            `${name} failed to get the spp`
        )

        console.log(`${name} sees that spp has `, {
            capacity: sppDetails[0].toNumber(),
            output: sppDetails[1].toNumber()
        })

        assert(sppDetails[0].toNumber() == 35)
        assert(sppDetails[1].toNumber() == 15)

        console.log(`${name} has ${fmt(await stdlib.balanceOf(account))}`)

        // Increase output

        await callAPI(
            name,
            () => spp.increaseOutput(5),
            `${name} managed to increase the spp output`,
            `${name} failed to increase the spp output`
        )

        sppDetails = await callAPI(
            name,
            () => spp.get(),
            `${name} managed to get the spp`,
            `${name} failed to get the spp`
        )

        console.log(`${name} sees that spp has `, {
            capacity: sppDetails[0].toNumber(),
            output: sppDetails[1].toNumber()
        })

        assert(sppDetails[0].toNumber() == 35)
        assert(sppDetails[1].toNumber() == 20)

        console.log(`${name} has ${fmt(await stdlib.balanceOf(account))}`)

        // Stop the contract

        console.log(`${name} is trying to stop the contract...`)

        await callAPI(
            name,
            () => spp.stop(),
            `${name} managed to stop the contract`,
            `${name} failed to stop the contract`
        )

        console.log(`${name} has ${fmt(await stdlib.balanceOf(account))}`)
    }
}

const testAndStop = async () => {
    console.log('>> Test and stop')
    const accAdmin = await setup()
    const ready = new Signal()

    await getAndLogBalance(accAdmin, 'Admin')

    console.log('Deploying the contract...')

    // Deploy the dapp
    const ctcAdmin = accAdmin.contract(backend)

    await Promise.all([
        thread(await userConnectAndStop('Admin', accAdmin, ctcAdmin, ready)),
        backend.Admin(ctcAdmin, {
            log: ((...args) => {
                console.log(...args)
                ready.notify()
            }),
            onReady: async (contract) => {
                console.log(`Contract deployed ${JSON.stringify(contract)}`)
                const adminAlgo = await stdlib.balanceOf(accAdmin)
                console.log(`Admin has ${fmt(adminAlgo)}`)
            }
        })
    ])

    console.log('Contract stopped.')
    const adminAlgo = await getAndLogBalance(accAdmin, 'Admin')
    assert(parseFloat(adminAlgo) < 100)
}

await testAndStop()
