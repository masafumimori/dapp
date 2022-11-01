import { ReachContext } from 'context/reach-context.ts'
import { UserContext } from 'context/user-context.js'
import { useContext } from 'react'

export function useTokenMinter() {
    const { stdlib } = useContext(ReachContext)
    const { walletAccount } = useContext(UserContext)

    async function mint({ name, symbol, url, metadataHash }) {
        const hashBuffer = Buffer.from(metadataHash, 'base64')
        const hashArray = new Uint8Array(hashBuffer)
        try {
            const launchTokenResponse = await stdlib.launchToken(walletAccount, name, symbol, {
                supply: 1,
                decimals: 0,
                url,
                metadataHash: hashArray
            })
            return launchTokenResponse.id.toNumber()
        } catch (e) {
            return false
        }
    }

    return { mint }
}
