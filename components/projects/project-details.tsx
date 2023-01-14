import ActionBar from 'components/action-bar'
import { AssetLink } from 'components/asset-link'
import Button, { ButtonType } from 'components/button'
import { ContractLink } from 'components/contract-link'
import { ImageUploader } from 'components/image-uploader'
import { InputField } from 'components/input-field'
import { Label } from 'components/label'
import LoadingSpinner from 'components/loading-spinner.js'
import { ParagraphMaker } from 'components/paragraph-maker/paragraph-maker'
import { ReachContext, ReachStdlib } from 'context/reach-context'
import { UserContext } from 'context/user-context.js'
import { useAuth } from 'hooks/use-auth.js'
import { FileUploadState, useFileUploader } from 'hooks/use-file-uploader'
import usePrevious from 'hooks/use-previous.js'
import { User } from 'hooks/use-user.js'
import { useCallback, useContext, useEffect, useState } from 'react'
import { strings } from 'strings/en.js'
import { endpoints, ipfsUrl } from 'utils/api-config.js'
import { getContractFromJsonString, ipfsUrlToGatewayUrl } from 'utils/string-utils.js'
import { cidFromAlgorandAddress } from 'utils/token-utils.js'
import styles from './project-details.module.scss'

type ProjectDetailsProps = {
    id: string
}

type ProjectDetails = {
    contractId: string
    created: number
    creator: string
    logoUrl: string
    name: string
    description: string
    tokenId: string
    balance: number
    budget: number
    approved: boolean
}

type UpdatedProjectProperties = {
    name: string
    description: string
    properties: object
    imageFile: File
}

const ProjectDetails = ({ id }: ProjectDetailsProps) => {
    const { stdlib } = useContext<ReachStdlib>(ReachContext)
    const user = useContext<User>(UserContext)
    const [project, setProject] = useState<ProjectDetails | null>()
    const [updatedProject, setUpdatedProject] = useState<UpdatedProjectProperties>({} as UpdatedProjectProperties)
    const [error, setError] = useState<string | null>()
    const [editing, setEditing] = useState<boolean>(false)
    const [inProgress, setInProgress] = useState<boolean>(false)

    const { upload, uploadState, fileProps } = useFileUploader({
        name: updatedProject.name,
        description: updatedProject.description,
        properties: {}
    })

    const { getAuthHeader } = useAuth()

    const fetchProject = useCallback(async () => {
        if (!id) return
        setError(null)

        const response = await fetch(endpoints.project(id))

        if (response.ok) {
            const { name, reserve, created, creator, offChainImageUrl, balance, tokenId, approved } =
                await response.json()
            const contractId = stdlib.bigNumberToNumber(getContractFromJsonString(id))

            setProject({
                contractId,
                name,
                created: parseInt(created),
                creator,
                balance,
                tokenId,
                approved,
                logoUrl: offChainImageUrl
            } as ProjectDetails)

            // Try to fetch NFT metadata and image from IPFS
            try {
                const cid = cidFromAlgorandAddress(stdlib.algosdk, reserve)
                const metadataUrl = ipfsUrl(cid)
                const metadataResponse = await fetch(metadataUrl)

                if (metadataResponse.ok) {
                    const { name, image, description, properties } = await metadataResponse.json()
                    setProject(
                        project =>
                            ({
                                ...project,
                                logoUrl: ipfsUrlToGatewayUrl(image),
                                name,
                                description,
                                budget: properties.budget.value
                            } as ProjectDetails)
                    )
                }

                setInProgress(false)
            } catch (e) {}
        } else {
            setError(strings.errorFetchingProject)
        }
    }, [id, stdlib])

    const approveProject = useCallback(
        async (approvalStatus: boolean) => {
            setError(null)
            setInProgress(true)
            try {
                const authHeader = await getAuthHeader(user.walletAddress)
                const response = await fetch(endpoints.projectApproval(id), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: authHeader
                    },
                    referrerPolicy: 'no-referrer',
                    body: JSON.stringify({
                        approved: approvalStatus
                    })
                })

                if (response.ok) {
                    fetchProject()
                } else {
                    throw new Error()
                }
            } catch (e) {
                setError(strings.errorApprovingProject)
                setInProgress(false)
            }
        },
        [fetchProject, getAuthHeader, id, user.walletAddress]
    )

    useEffect(() => {
        setEditing(false)
        fetchProject()
    }, [fetchProject])

    function canEdit() {
        return user && project && (user.isAdmin || user.walletAddress === project.creator) ? true : false
    }

    async function edit() {
        if (!project) return
        const fileBlob = await (await fetch(project.logoUrl)).blob()

        setUpdatedProject({
            name: project.name,
            description: project.description,
            imageFile: new File([fileBlob], 'file', fileBlob),
            properties: {}
        })

        setError(null)
        setEditing(true)
    }

    function setFile(file: File) {
        setUpdatedProject(project => ({
            ...project,
            imageFile: file
        }))
    }

    function setName(name: string) {
        setUpdatedProject(project => ({
            ...project,
            name
        }))
    }

    function setDescription(description: string) {
        setUpdatedProject(project => ({
            ...project,
            description
        }))
    }

    function isUpdateValid() {
        return updatedProject.imageFile && !!updatedProject.name && !!updatedProject.description
    }

    function isUpdateInProgress() {
        const failed = uploadState === FileUploadState.ERROR || !!error
        return !failed && inProgress
    }

    /**
     * 1. Save project file on S3 and IPFS
     */
    function submit() {
        if (!updatedProject) return
        setInProgress(true)
        upload(updatedProject.imageFile)
    }

    /**
     * 2. Create a smart contract for the project on the blockchain
     */
    const prevUploadState = usePrevious(uploadState)
    useEffect(() => {
        async function saveProject() {
            try {
                const authHeader = await getAuthHeader(user.walletAddress)
                const response = await fetch(endpoints.project(id), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: authHeader
                    },
                    referrerPolicy: 'no-referrer',
                    body: JSON.stringify({
                        name: fileProps.name,
                        url: fileProps.ipfsMetadataUrl,
                        hash: fileProps.ipfsMetadataHash,
                        offChainImageUrl: fileProps.offChainUrl
                    })
                })

                if (!response.ok) {
                    setError(strings.errorUpdatingProject)
                }
            } catch (e) {
                setError(strings.errorUpdatingProject)
            }
            setInProgress(false)
        }

        if (uploadState === FileUploadState.PINNED && prevUploadState !== FileUploadState.PINNED) {
            saveProject()
        } else if (uploadState === FileUploadState.ERROR) {
            setInProgress(false)
            setError(strings.errorCreatingProject)
        }
    }, [
        fileProps.ipfsMetadataHash,
        fileProps.ipfsMetadataUrl,
        fileProps.name,
        fileProps.offChainUrl,
        getAuthHeader,
        id,
        prevUploadState,
        uploadState,
        user.walletAddress
    ])

    return (
        <>
            <div className={styles.container}>
                {!project && !error && <LoadingSpinner />}
                {project && !editing && (
                    <>
                        <div className={styles.section}>
                            <img src={project.logoUrl} alt={project.name} className={styles.image} />
                        </div>
                        <div className={styles.section}>
                            <Label text={strings.contractId} />
                            <div className={styles.content}>
                                <ContractLink contractId={project.contractId} />
                            </div>
                        </div>
                        <div className={styles.section}>
                            <Label text={strings.assetID} />
                            <div className={styles.content}>
                                <AssetLink assetId={project.tokenId} />
                            </div>
                        </div>
                        <div className={styles.section}>
                            <Label text={strings.created} />
                            <div className={styles.content}>{new Date(project.created).toLocaleDateString()}</div>
                        </div>
                        <div className={styles.section}>
                            <Label text={strings.projectBudgetAlgo} />
                            <div className={styles.content}>{project.budget}</div>
                        </div>
                        <div className={styles.section}>
                            <Label text={strings.projectBalanceAlgo} />
                            <div className={styles.content}>{project.balance}</div>
                        </div>
                        <div className={styles.section}>
                            <Label text={strings.approvalStatus} />
                            <div className={styles.content}>
                                {project.approved ? strings.approved : strings.underReview}
                            </div>
                        </div>
                        <div className={styles.section}>
                            <Label text={strings.description} />
                            <div className={styles.content}>
                                <ParagraphMaker text={project.description} />
                            </div>
                        </div>
                    </>
                )}
                {project && editing && (
                    <>
                        <div className={styles.section}>
                            <Label text={strings.projectLogo} />
                            <ImageUploader imageUrl={project.logoUrl} onFileSelected={file => setFile(file)} />
                        </div>
                        <div className={styles.section}>
                            <Label text={strings.contractId} />
                            <div className={styles.content}>
                                <ContractLink contractId={project.contractId} />
                            </div>
                        </div>
                        <div className={styles.section}>
                            <Label text={strings.created} />
                            <div className={styles.content}>{new Date(project.created).toLocaleDateString()}</div>
                        </div>
                        <div className={styles.section}>
                            <InputField initialValue={project.name} label={strings.name} onChange={setName} />
                        </div>
                        <div className={styles.section}>
                            <InputField
                                initialValue={project.description}
                                multiline
                                max={5000}
                                rows={10}
                                label={strings.description}
                                onChange={setDescription}
                            />
                        </div>
                    </>
                )}
            </div>
            {canEdit() && (
                <ActionBar>
                    {error && <div className={styles.error}>{error}</div>}
                    {!editing && !inProgress && (
                        <div className={styles.buttonContainer}>
                            <Button
                                className={styles.button}
                                type={ButtonType.OUTLINE}
                                label={strings.edit}
                                onClick={edit}
                            />
                            {user && user.isAdmin && project && (
                                <Button
                                    className={styles.button}
                                    type={ButtonType.OUTLINE}
                                    label={project.approved ? strings.reject : strings.approve}
                                    onClick={() => approveProject(!project.approved)}
                                />
                            )}
                        </div>
                    )}
                    {!editing && inProgress && <LoadingSpinner />}
                    {editing && (
                        <Button
                            className={styles.button}
                            type={ButtonType.OUTLINE}
                            label={strings.update}
                            disabled={!isUpdateValid()}
                            loading={isUpdateInProgress()}
                            onClick={submit}
                        />
                    )}
                </ActionBar>
            )}
        </>
    )
}

export default ProjectDetails
