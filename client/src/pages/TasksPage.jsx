import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { getTasks, completeTask } from '../api';

export default function TasksPage() {
    const { updateUser } = useUser();
    const [dailyTasks, setDailyTasks] = useState([]);
    const [generalTasks, setGeneralTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [completing, setCompleting] = useState(null);

    const fetchTasks = async () => {
        try {
            const res = await getTasks();
            setDailyTasks(res.data.daily || []);
            setGeneralTasks(res.data.general || []);
        } catch (err) {
            console.error('Failed to fetch tasks:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleComplete = async (taskId) => {
        if (completing) return;
        setCompleting(taskId);
        try {
            const res = await completeTask(taskId);
            updateUser({ tokens: res.data.newTokenBalance });
            // Refresh tasks to update completion status
            await fetchTasks();
        } catch (err) {
            console.error('Failed to complete task:', err);
        } finally {
            setCompleting(null);
        }
    };

    if (loading) {
        return (
            <div className="page tasks-page">
                <div className="loading-container">
                    <div className="spinner large"></div>
                    <p>Loading tasks...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page tasks-page">
            {/* Daily Tasks */}
            <div className="section-title">
                <span className="title-icon">📋</span>
                Daily Tasks
                <span className="reset-hint">Resets in 24h</span>
            </div>

            <div className="task-list">
                {dailyTasks.map(task => (
                    <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                        <div className="task-left">
                            <span className="task-icon">{task.icon}</span>
                            <div className="task-info">
                                <span className="task-name">{task.name}</span>
                                <span className="task-desc">{task.description}</span>
                            </div>
                        </div>
                        <div className="task-right">
                            {task.completed ? (
                                <span className="task-done">✅</span>
                            ) : (
                                <button
                                    className="task-claim-btn"
                                    onClick={() => handleComplete(task.id)}
                                    disabled={completing === task.id}
                                >
                                    {completing === task.id ? '...' : `+${task.reward}`}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* General Tasks */}
            <div className="section-title" style={{ marginTop: '1.5rem' }}>
                <span className="title-icon">🎯</span>
                General Tasks
                <span className="reset-hint">One-time</span>
            </div>

            <div className="task-list">
                {generalTasks.map(task => (
                    <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                        <div className="task-left">
                            <span className="task-icon">{task.icon}</span>
                            <div className="task-info">
                                <span className="task-name">{task.name}</span>
                                <span className="task-desc">{task.description}</span>
                            </div>
                        </div>
                        <div className="task-right">
                            {task.completed ? (
                                <span className="task-done">✅</span>
                            ) : (
                                <button
                                    className="task-claim-btn"
                                    onClick={() => handleComplete(task.id)}
                                    disabled={completing === task.id}
                                >
                                    {completing === task.id ? '...' : `+${task.reward}`}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
