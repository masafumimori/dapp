import { algonodeIndexerBaseUrl, setMethodNotAllowedResponse } from '../../../utils/api-config'

export default async function handler(req, res) {
    switch (req.method) {
        case 'GET':
            const [assetResponse, balanceResponse] = await Promise.all([
                fetch(`${algonodeIndexerBaseUrl}/assets/${req.query.assetId}`),
                fetch(`${algonodeIndexerBaseUrl}/assets/${req.query.assetId}/balances`)
            ])

            const [{ asset }, { balances }] = await Promise.all([assetResponse.json(), balanceResponse.json()])

            if (!asset || asset.params['unit-name'] !== 'TRCL') {
                res.status(404).json({ error: 'No TRCL found with this asset-id' })
            } else {
                res.send({
                    asset: ({
                        id: asset.index,
                        name: asset.params.name,
                        symbol: asset.params['unit-name'],
                        url: asset.params.url,
                        holders: balances
                            .filter(balance => balance.amount > 0)
                            .map(balance => ({
                                address: balance.address,
                                amount: balance.amount
                            }))
                    })
                })
            }
            break
        default:
            setMethodNotAllowedResponse(res, ['GET'])
    }
}
