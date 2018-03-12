import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import fs from 'fs';

var Schema = mongoose.Schema;
var issueLabelSchema = new Schema({
	repo: {type: Schema.Types.ObjectId, ref: 'Repo'},
	title: {
		type: String,
		required: [true, 'title is required'],
		minlength: 1
	}
});

// callback(err: Error, exists: bool)
issueLabelSchema.statics.exists = function(repo, title, callback){
	IssueLabel
		.find({
			repo: repo._id
		}, (err, labels) => {
			if(!err && labels != null){
				let exists = false;
				console.log(labels);
				for(let i = 0; i < labels.length; i++){
					if(labels[i].title == title){
						exists = true;
						break;
					}
				}
				callback(null, exists);
			}else{
				callback(err);
			}
		});
}

// callback(err: Error, label: IssueLabel);
issueLabelSchema.statics.create = function(repo, title, callback){
	let label = new IssueLabel();
	label.title = title;
	label.repo = repo._id;
	label.save((err, l) => {
		if(!err){
			repo.issueLabels.push(l._id);
			repo.save((err, l) => {
				if(!err)
					callback(null, label);
				else
					callback(err);
			})
		}else{
			callback(err);
		}
	});
}

var IssueLabel = mongoose.model('IssueLabel', issueLabelSchema);

export default IssueLabel;