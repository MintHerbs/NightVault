import SentinelFace from './SentinelFace'
import styles from './DynamicIsland.module.css'

export default function ErrorContent({ message }) {
  return (
    <>
      <SentinelFace variant="soft" color="red" />
      <span className={styles.errorText}>{message}</span>
    </>
  )
}
