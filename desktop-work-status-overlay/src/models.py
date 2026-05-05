from dataclasses import dataclass


@dataclass
class DesktopState:
    projectName: str = ""
    gptStatus: str = "待機"
    claudeStatus: str = "待機"
    memo: str = ""
    updatedAt: str = ""

    def to_dict(self) -> dict:
        return {
            "projectName": self.projectName,
            "gptStatus": self.gptStatus,
            "claudeStatus": self.claudeStatus,
            "memo": self.memo,
            "updatedAt": self.updatedAt,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "DesktopState":
        return cls(
            projectName=d.get("projectName", ""),
            gptStatus=d.get("gptStatus", "待機"),
            claudeStatus=d.get("claudeStatus", "待機"),
            memo=d.get("memo", ""),
            updatedAt=d.get("updatedAt", ""),
        )
