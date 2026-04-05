// Skill管理模块
// 负责加载、管理和执行各种技能模块

class SkillManager {
    constructor() {
        this.skills = {};
        this.loadedSkills = [];
    }
    
    // 加载所有技能
    async loadSkills() {
        try {
            // 这里可以扩展为从目录动态加载技能
            const skills = [
                'dataCleaning',
                'dataAnalysis',
                'trendAnalysis',
                'anomalyDetection',
                'businessAdvice',
                'chartGenerator'
            ];
            
            for (const skillName of skills) {
                try {
                    const skillModule = await import(`./${skillName}.js`);
                    this.skills[skillName] = skillModule.default;
                    this.loadedSkills.push(skillName);
                    console.log(`✅ 加载技能: ${skillName}`);
                } catch (error) {
                    console.warn(`❌ 加载技能 ${skillName} 失败:`, error.message);
                }
            }
            
            return this.loadedSkills;
        } catch (error) {
            console.error('加载技能失败:', error);
            return [];
        }
    }
    
    // 获取所有已加载的技能
    getLoadedSkills() {
        return this.loadedSkills;
    }
    
    // 执行指定技能
    async executeSkill(skillName, data, options = {}) {
        if (!this.skills[skillName]) {
            throw new Error(`技能 ${skillName} 未加载`);
        }
        
        try {
            const skill = this.skills[skillName];
            return await skill.execute(data, options);
        } catch (error) {
            console.error(`执行技能 ${skillName} 失败:`, error);
            throw error;
        }
    }
    
    // 获取技能信息
    getSkillInfo(skillName) {
        if (!this.skills[skillName]) {
            return null;
        }
        
        return this.skills[skillName].info;
    }
}

// 导出SkillManager类
export default SkillManager;